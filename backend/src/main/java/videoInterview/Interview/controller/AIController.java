package videoInterview.Interview.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import videoInterview.Interview.service.GeminiService;

import java.util.*;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AIController {

    private final GeminiService geminiService;

    @PostMapping("/chat")
    @PreAuthorize("hasRole('INTERVIEWER')")
    public ResponseEntity<Map<String, String>> chat(
            @RequestBody Map<String, Object> request
    ) {
        String question = (String) request.get("question");
        String code     = (String) request.get("code");
        String language = (String) request.get("language");
        String message  = (String) request.get("message");

        List<Map<String, String>> history = parseHistory(request.get("history"));

        String response = geminiService.analyze(question, code, language, message, history);

        return ResponseEntity.ok(Map.of("response", response));
    }

    private List<Map<String, String>> parseHistory(Object historyObj) {
        List<Map<String, String>> history = new ArrayList<>();

        if (!(historyObj instanceof List<?>)) return history;

        for (Object item : (List<?>) historyObj) {
            if (!(item instanceof Map<?, ?>)) continue;

            Map<String, String> entry = new HashMap<>();
            for (Map.Entry<?, ?> mapEntry : ((Map<?, ?>) item).entrySet()) {
                if (mapEntry.getKey() instanceof String &&
                    mapEntry.getValue() instanceof String) {
                    entry.put((String) mapEntry.getKey(),
                              (String) mapEntry.getValue());
                }
            }
            if (!entry.isEmpty()) {
                history.add(entry);
            }
        }

        return history;
    }
}