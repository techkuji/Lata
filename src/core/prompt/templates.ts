/**
 * Assembles the final prompt string using a Fill-in-the-Middle (FIM) template.
 * This function selects the correct FIM tokens or template based on the target model type.
 */
export function formatFimPrompt(
    prefix: string, 
    suffix: string, 
    highLevelContext: string, 
    modelType: string,
    languageId: string,
    fileName: string
): string {
    const defaultSystemPrompt = `You are an expert AI code completion engine. Your only function is to generate raw code that completes the user's input.`;
    const defaultInstructions = `
<instructions>
Your Task:
You will be given a prefix and a suffix of a text file. Your task is to generate the code or text that should be inserted between them to complete the user's input.

CRITICAL RULES:
1.  RAW TEXT ONLY: Your entire response must be raw text/code that can be directly inserted.
2.  NO CONVERSATION: DO NOT output conversational phrases like "Here is the completed code:", "Certainly, here is the suggestion:", or any other explanatory text.
3.  NO MARKDOWN: DO NOT wrap your response in markdown code blocks (e.g., \`\`\`python ... \`\`\`).
4.  ANALYZE INTENT: Analyze the prefix to determine if the user is writing code, a comment, or a string literal. Your suggestion must match that intent.
5.  RESPECT SYNTAX:
    -   If the user is in the middle of a statement, complete it.
    -   If the user has just completed a statement (e.g., with a ';' or '}'), suggest the next logical statement on a new line with correct indentation.
6.  BE CONFIDENT OR SILENT: If you cannot make a high-confidence prediction, you MUST return an empty string. Do not guess.
</instructions>
    `.trim();

    let fimTemplate: string;

    switch (modelType.toLowerCase()) {
        case 'codellama':
          fimTemplate = `<<FIM_START>>\n${prefix}\n<<FIM_MIDDLE>>\n${suffix}\n<<FIM_END>>`;
          break;
        case 'starcoder':
          fimTemplate = `<fim_prefix>${prefix}<fim_suffix>${suffix}<fim_middle>`;
          break;
        case 'deepseek':
          fimTemplate = `<｜fim begin｜>${prefix}<｜fim hole｜>${suffix}<｜fim end｜>`;
          break;
        case 'hole-filler':
          const holeFillerSystemMsg = `You are a HOLE FILLER. You are provided with a file containing holes, formatted as '{{HOLE_NAME}}'. Your TASK is to complete with a string to replace this hole with, inside a <COMPLETION/> XML tag, including context-aware indentation, if needed.  All completions MUST be truthful, accurate, well-written and correct.

## EXAMPLE QUERY:

<QUERY>
function sum_evens(lim) {
  var sum = 0;
  for (var i = 0; i < lim; ++i) {
    {{FILL_HERE}}
  }
  return sum;
}
</QUERY>

TASK: Fill the {{FILL_HERE}} hole.

## CORRECT COMPLETION

<COMPLETION>if (i % 2 === 0) {
      sum += i;
    }</COMPLETION>

## EXAMPLE QUERY:

<QUERY>
def sum_list(lst):
  total = 0
  for x in lst:
  {{FILL_HERE}}
  return total

print sum_list([1, 2, 3])
</QUERY>

## CORRECT COMPLETION:

<COMPLETION>  total += x</COMPLETION>

## EXAMPLE QUERY:

<QUERY>
// data Tree a = Node (Tree a) (Tree a) | Leaf a

// sum :: Tree Int -> Int
// sum (Node lft rgt) = sum lft + sum rgt
// sum (Leaf val)     = val

// convert to TypeScript:
{{FILL_HERE}}
</QUERY>

## CORRECT COMPLETION:

<COMPLETION>type Tree<T>
  = {$:"Node", lft: Tree<T>, rgt: Tree<T>}
  | {$:"Leaf", val: T};

function sum(tree: Tree<number>): number {
  switch (tree.$) {
    case "Node":
      return sum(tree.lft) + sum(tree.rgt);
    case "Leaf":
      return tree.val;
  }
}</COMPLETION>

## EXAMPLE QUERY:

The 5th {{FILL_HERE}} is Jupiter.

## CORRECT COMPLETION:

<COMPLETION>planet from the Sun</COMPLETION>

## EXAMPLE QUERY:

function hypothenuse(a, b) {
  return Math.sqrt({{FILL_HERE}}b ** 2);
}

## CORRECT COMPLETION:

<COMPLETION>a ** 2 + </COMPLETION>`;

            const fullPrompt = `${holeFillerSystemMsg}\n\n<QUERY>\n${highLevelContext}\n\n${prefix}{{FILL_HERE}}${suffix}\n</QUERY>\nTASK: Fill the {{FILL_HERE}} hole. Answer only with the CORRECT completion, and NOTHING ELSE. Do it now.\n<COMPLETION>`;
            return fullPrompt;

        default: // For OpenAI, Claude, Gemini, a robust XML style
            fimTemplate = `<file_context file_path="${fileName}" language="${languageId}">\n<prefix>${prefix}</prefix>\n<suffix>${suffix}</suffix>\n</file_context>`;
            break;
    }

    return `${defaultSystemPrompt}\n\n${defaultInstructions}\n\n<high_level_context>\n${highLevelContext}\n</high_level_context>\n\n${fimTemplate}`;
}
