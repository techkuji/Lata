import axios from 'axios';
import * as vscode from 'vscode';

// Response Interfaces for each API
interface OllamaResponse { response: string; }
interface OpenAIResponse { choices: { message: { content: string; }; }[]; }
interface ClaudeResponse { content: { type: string; text: string; }[]; }
interface GeminiResponse { candidates: { content: { parts: { text: string; }[]; }; }[]; }

// Common constants
const COMPLETION_MAX_TOKENS = 512;
const COMPLETION_TEMPERATURE = 0.2;

// Any LLM base class
export abstract class LLM {
    protected config = vscode.workspace.getConfiguration('lata');

    abstract providerName: string;
    abstract getCompletion(prompt: string): Promise<string>;

    protected cleanLLMResponse(response: string): string {
        let cleaned = response;

        // handle <COMPLETION> tag for the hole-filler
        const holeFillerMatch = cleaned.match(/<COMPLETION>([\s\S]*?)<\/COMPLETION>/);
        if (holeFillerMatch && holeFillerMatch[1]) {
            cleaned = holeFillerMatch[1];
        }

        // remove any other known prompt tags
        cleaned = cleaned.replace(/<\/?COMPLETION>/g, '');

        // remove markdown
        cleaned = cleaned.replace(/```[\s\S]*?```/g, match => match.replace(/```[a-z]*\n?/gi, '').trim());
        cleaned = cleaned.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '');

        // remove conversational phrases
        const conversationalPatterns = [
            /^Here is the code completion:/i,
            /^Certainly, here is the code:/i,
            /^Here is the completed code:/i,
            /^Here is the code:/i,
        ];
        for (const pattern of conversationalPatterns) {
            cleaned = cleaned.replace(pattern, '');
        }

        return cleaned.trim();
    }
}

export class OllamaLLM extends LLM {
    providerName = 'ollama';
    async getCompletion(prompt: string): Promise<string> {
        const endpoint = this.config.get<string>('localEndpoint');
        const model = this.config.get<string>('localModel');
        const modelType = this.config.get<string>('modelType');
        if (!endpoint || !model) {
            vscode.window.showErrorMessage('Ollama endpoint or model not configured.');
            return '';
        }
        try {
            const requestBody: any = {
                model: model, 
                prompt: prompt, 
                stream: false, 
                options: { temperature: COMPLETION_TEMPERATURE }
            };

            if (modelType === 'hole-filler') {
                requestBody.options.stop = ["</COMPLETION>"];
            }

            const response = await axios.post<OllamaResponse>(endpoint, requestBody);
            return this.cleanLLMResponse(response.data?.response || '');
        } catch (error) {
            console.error('Error fetching Ollama completion:', error);
            return '';
        }
    }
}

export class OpenAILLM extends LLM {
    providerName = 'openai';
    async getCompletion(prompt: string): Promise<string> {
        const apiKey = this.config.get<string>('openAIApiKey');
        const model = this.config.get<string>('openAIModel');
        const endPoint = this.config.get<string>('openAIEndpoint');
        const modelType = this.config.get<string>('modelType');
        if (!apiKey || !model || !endPoint) {
            vscode.window.showErrorMessage('OpenAI settings not configured.');
            return '';
        }
        try {
            const requestBody: any = { 
                model: model, 
                messages: [{ role: 'user', content: prompt }], 
                max_tokens: COMPLETION_MAX_TOKENS, 
                temperature: COMPLETION_TEMPERATURE 
            };
            
            if (modelType === 'hole-filler') {
                requestBody.stop = ["</COMPLETION>"];
            }

            const response = await axios.post<OpenAIResponse>(endPoint, requestBody,
                { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
            );
            return this.cleanLLMResponse(response.data?.choices?.[0]?.message?.content || '');
        } catch (error) {
            console.error('Error fetching OpenAI completion:', error);
            return '';
        }
    }
}

export class ClaudeLLM extends LLM {
    providerName = 'claude';
    async getCompletion(prompt: string): Promise<string> {
        const apiKey = this.config.get<string>('claudeApiKey');
        const model = this.config.get<string>('claudeModel');
        const endPoint = this.config.get<string>('claudeEndpoint');
        const modelType = this.config.get<string>('modelType');
        if (!apiKey || !model || !endPoint) {
            vscode.window.showErrorMessage('Claude settings not configured.');
            return '';
        }
        try {
            const requestBody: any = { 
                model: model, 
                max_tokens: COMPLETION_MAX_TOKENS, 
                temperature: COMPLETION_TEMPERATURE, 
                messages: [{ role: 'user', content: prompt }] 
            };
            if (modelType === 'hole-filler') {
                requestBody.stop_sequences = ["</COMPLETION>"];
            }
            const headers = { 
                'x-api-key': apiKey, 
                'anthropic-version': '2023-06-01', 
                'content-type': 'application/json' 
            };

            const response = await axios.post<ClaudeResponse>(endPoint, requestBody, { headers });
            return this.cleanLLMResponse(response.data?.content?.[0]?.text || '');
        } catch (error: any) {
            vscode.window.showErrorMessage(`Claude API Error, please check the creds`);
            return '';
        }
    }
}

export class GeminiLLM extends LLM {
    providerName = 'gemini';
    async getCompletion(prompt: string): Promise<string> {
        const apiKey = this.config.get<string>('geminiApiKey');
        const model = this.config.get<string>('geminiModel');
        const baseEndpoint = this.config.get<string>('geminiEndpoint');
        const modelType = this.config.get<string>('modelType');
        if (!apiKey || !model || !baseEndpoint) {
            vscode.window.showErrorMessage('Gemini settings not configured.');
            return '';
        }
        try {
            const fullEndpoint = `${baseEndpoint.replace(/\/$/, '')}/${model}:generateContent?key=${apiKey}`;
            const requestBody: any = { 
                contents: [{ parts: [{ text: prompt }] }], 
                generationConfig: { 
                    maxOutputTokens: COMPLETION_MAX_TOKENS, 
                    temperature: COMPLETION_TEMPERATURE 
                } 
            };

            if (modelType === 'hole-filler') {
                requestBody.generationConfig.stopSequences = ["</COMPLETION>"]; // Gemini uses 'stopSequences'
            }

            const response = await axios.post<GeminiResponse>(fullEndpoint, requestBody,
                { headers: { 'Content-Type': 'application/json' } }
            );
            return this.cleanLLMResponse(response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '');
        } catch (error) {
            console.error('Error fetching Gemini completion:', error);
            return '';
        }
    }
}

export class SelfHostedLLM extends LLM {
    providerName = this.config.get<string>('selfHostedModelProvider') || 'unknown';
    async getCompletion(prompt: string): Promise<string> {
        const apiKey = this.config.get<string>('selfHostedAPIKey');
        const model = this.config.get<string>('selfHostedModel');
        const endPoint = this.config.get<string>('selfHostedEndPoint');
        const modelType = this.config.get<string>('modelType');
        if (!apiKey || !model || !endPoint) {
            vscode.window.showErrorMessage('OpenAI settings not configured.');
            return '';
        }
        try {
            console.log(`SelfHostedLLM initialized, provider: ${this.providerName}, model: ${model}, endpoint: ${endPoint}`);
            const requestBody: any = { 
                model: model, 
                messages: [{ role: 'user', content: prompt }], 
                max_tokens: COMPLETION_MAX_TOKENS, 
                temperature: COMPLETION_TEMPERATURE 
            };
            
            if (modelType === 'hole-filler') {
                requestBody.stop = ["</COMPLETION>"];
            }

            switch (this.providerName) {
                case 'openai':
                    const response = await axios.post<OpenAIResponse>(endPoint, requestBody,
                        { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
                    );
                    console.log("OpenAI response received.");
                    console.log(response.data);
                    return this.cleanLLMResponse(response.data?.choices?.[0]?.message?.content || '');
                default:
                    vscode.window.showErrorMessage(`Unsupported self-hosted LLM provider: ${this.providerName}`);
                    return '';
            }

        } catch (error) {
            console.error('Error fetching OpenAI completion:', error);
            return '';
        }
    }
}