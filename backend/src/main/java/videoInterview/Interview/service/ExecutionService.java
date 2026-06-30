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

        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        mapper.configure(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        mapper.configure(com.fasterxml.jackson.databind.DeserializationFeature.USE_LONG_FOR_INTS, false);

        try {
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);

            org.springframework.http.HttpEntity<Map<String, Object>> entity = new org.springframework.http.HttpEntity<>(
                    payload, headers);

            org.springframework.http.ResponseEntity<String> rawResponse = restTemplate.postForEntity(
                    executorUrl + "/execute",
                    entity,
                    String.class);

            return mapper.readValue(rawResponse.getBody(), ExecutionResponse.class);

        } catch (org.springframework.web.client.HttpServerErrorException e) {
            // Executor returned 5xx — parse its JSON error body and return it as a valid response
            // so the frontend can display the actual error message
            System.err.println("❌ Executor 5xx: " + e.getResponseBodyAsString());
            try {
                return mapper.readValue(e.getResponseBodyAsString(), ExecutionResponse.class);
            } catch (Exception parseEx) {
                ExecutionResponse errResp = new ExecutionResponse();
                errResp.setStderr("Executor service error: " + e.getStatusCode());
                errResp.setPassed(false);
                errResp.setResults(java.util.Collections.emptyList());
                return errResp;
            }
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            System.err.println("❌ Executor 4xx: " + e.getResponseBodyAsString());
            throw new RuntimeException("Executor error: " + e.getResponseBodyAsString());
        } catch (org.springframework.web.client.ResourceAccessException e) {
            // Executor is unreachable (connection refused, timeout, etc.)
            System.err.println("❌ Executor unreachable: " + e.getMessage());
            ExecutionResponse errResp = new ExecutionResponse();
            errResp.setStderr("Executor service is not running. Please start the executor service.");
            errResp.setPassed(false);
            errResp.setResults(java.util.Collections.emptyList());
            return errResp;
        } catch (Exception e) {
            System.err.println("❌ Execution failed: " + e.getMessage());
            throw new RuntimeException("Execution failed: " + e.getMessage());
        }
    }
}