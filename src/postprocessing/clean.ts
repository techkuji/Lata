export function cleanSuggestion(suggestion: string): string {
    let cleaned = suggestion;

    // remove markdown code blocks
    cleaned = cleaned.replace(/```[\w\s]*\n/g, '').replace(/```/g, '');

    // remove conversational phrases
    const conversationalPatterns = [
        /^Here is the code completion:/,
        /^Certainly, here is the code:/,
        /^Here is the completed code:/
    ];
    for (const pattern of conversationalPatterns) {
        cleaned = cleaned.replace(pattern, '');
    }

    return cleaned.trim();
}
