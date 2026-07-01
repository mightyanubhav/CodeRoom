package videoInterview.Interview.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;

import java.util.*;

@Service
@RequiredArgsConstructor
public class GeminiService {

    @Value("${gemini.api.key}")
    private String apiKey;

    private final RestTemplate restTemplate;

    private static final String GEMINI_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

    public String analyze(
            String question,
            String code,
            String language,
            String userMessage,
            List<Map<String, String>> history
    ) {
        String systemContext = buildSystemContext(question, code, language);

        List<Map<String, Object>> contents = new ArrayList<>();

        // System context as first user turn
        Map<String, Object> systemMsg = new HashMap<>();
        systemMsg.put("role", "user");
        systemMsg.put("parts", List.of(Map.of("text", systemContext)));
        contents.add(systemMsg);

        // Model acknowledgment
        Map<String, Object> ackMsg = new HashMap<>();
        ackMsg.put("role", "model");
        ackMsg.put("parts", List.of(Map.of("text",
            "Understood. I am ready to assist you evaluate this interview session.")));
        contents.add(ackMsg);

        // Conversation history
        for (Map<String, String> msg : history) {
            Map<String, Object> histMsg = new HashMap<>();
            histMsg.put("role", "user".equals(msg.get("role")) ? "user" : "model");
            histMsg.put("parts", List.of(Map.of("text",
                msg.getOrDefault("content", ""))));
            contents.add(histMsg);
        }

        // Current user message
        Map<String, Object> currentMsg = new HashMap<>();
        currentMsg.put("role", "user");
        currentMsg.put("parts", List.of(Map.of("text", userMessage)));
        contents.add(currentMsg);

        // Generation config
        Map<String, Object> generationConfig = new HashMap<>();
        generationConfig.put("temperature", 0.7);
        generationConfig.put("maxOutputTokens", 1024);

        // Request body
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("contents", contents);
        requestBody.put("generationConfig", generationConfig);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-goog-api-key", apiKey);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        String url = GEMINI_URL;

        try {
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                url,
                HttpMethod.POST,
                entity,
                new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {}
            );

            Map<String, Object> body = response.getBody();
            if (body == null) return "No response from AI";

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> candidates =
                (List<Map<String, Object>>) body.get("candidates");
            if (candidates == null || candidates.isEmpty()) return "No candidates in response";

            Map<String, Object> candidate = candidates.get(0);

            @SuppressWarnings("unchecked")
            Map<String, Object> content =
                (Map<String, Object>) candidate.get("content");

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> parts =
                (List<Map<String, Object>>) content.get("parts");
            if (parts == null || parts.isEmpty()) return "No parts in response";

            return (String) parts.get(0).get("text");

        } catch (Exception e) {
            return "AI analysis unavailable: " + e.getMessage();
        }
    }

    private String buildSystemContext(String question, String code, String language) {
        return String.format("""
            You are an AI assistant helping an interviewer evaluate a technical interview in real time.

            Current interview context:
            - Question: %s
            - Programming Language: %s
            - Candidate's current code:
```%s
            %s
```

            Your role:
            - Help the interviewer evaluate the candidate's solution
            - Analyze code quality, correctness, time/space complexity
            - Suggest follow-up questions
            - Identify bugs and edge cases
            - Rate the solution
            - Suggest hints the interviewer can give
            - Be concise and actionable
            

            Respond in clear, structured markdown format.
            """,
            question != null ? question : "Not loaded yet",
            language != null ? language : "Unknown",
            language != null ? language.toLowerCase() : "",
            code != null ? code : "No code written yet"
        );
    }
}