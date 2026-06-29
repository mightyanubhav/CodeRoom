package videoInterview.Interview.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import videoInterview.Interview.dto.execution.ExecutionRequest;
import videoInterview.Interview.dto.execution.ExecutionResponse;
import videoInterview.Interview.entity.Question;
import videoInterview.Interview.entity.TestCase;
import videoInterview.Interview.repository.QuestionRepository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class ExecutionService {

    @Value("${executor.url:http://localhost:5002}")
    private String executorUrl;

    private final RestTemplate restTemplate;
    private final QuestionRepository questionRepository;

    public ExecutionResponse execute(ExecutionRequest request) {

        Map<String, Object> payload = new HashMap<>();

        if (request.getQuestionId() != null) {

            // Fetch test cases from DB
            Question question = questionRepository
                    .findByIdWithTestCases(request.getQuestionId())
                    .orElseThrow(() -> new RuntimeException("Question not found"));

            Stream<TestCase> stream = question.getTestCases().stream();

            if (!request.isSubmitAll()) {
                // ── Run button → visible test cases only, max 3 ──────────────
                stream = stream
                        .filter(tc -> !tc.isHidden())
                        .limit(3);
            }
            // ── Submit button → all test cases (visible + hidden) ─────────────

            List<Map<String, Object>> testCases = stream
                    .map(tc -> {
                        Map<String, Object> map = new HashMap<>();
                        map.put("input", tc.getInput());
                        map.put("expectedOutput", tc.getExpectedOutput());
                        map.put("hidden", tc.isHidden());
                        return map;
                    })
                    .collect(Collectors.toList());

            payload.put("code", request.getCode());
            payload.put("language", request.getLanguage());
            payload.put("testCases", testCases);

        } else {
            // No question — plain stdin run
            payload.put("code", request.getCode());
            payload.put("language", request.getLanguage());
            payload.put("stdin", request.getStdin() != null
                    ? request.getStdin()
                    : "");
        }

        try {
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);

            org.springframework.http.HttpEntity<Map<String, Object>> entity = new org.springframework.http.HttpEntity<>(
                    payload, headers);

            org.springframework.http.ResponseEntity<String> rawResponse = restTemplate.postForEntity(
                    executorUrl + "/execute",
                    entity,
                    String.class);

            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            mapper.configure(
                    com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES,
                    false);
            mapper.configure(
                    com.fasterxml.jackson.databind.DeserializationFeature.USE_LONG_FOR_INTS,
                    false);
            return mapper.readValue(rawResponse.getBody(), ExecutionResponse.class);

        } catch (org.springframework.web.client.HttpClientErrorException e) {
            System.err.println("❌ Executor error: " + e.getResponseBodyAsString());
            throw new RuntimeException("Executor error: " + e.getResponseBodyAsString());
        } catch (Exception e) {
            System.err.println("❌ Execution failed: " + e.getMessage());
            throw new RuntimeException("Execution failed: " + e.getMessage());
        }
    }
}