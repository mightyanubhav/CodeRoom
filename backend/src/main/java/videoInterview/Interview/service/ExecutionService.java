package videoInterview.Interview.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import videoInterview.Interview.dto.execution.ExecutionRequest;
import videoInterview.Interview.dto.execution.ExecutionResponse;
import videoInterview.Interview.entity.Question;
import videoInterview.Interview.repository.QuestionRepository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

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

            List<Map<String, Object>> testCases = question.getTestCases()
                    .stream()
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
            payload.put("code", request.getCode());
            payload.put("language", request.getLanguage());
            payload.put("stdin", request.getStdin() != null ? request.getStdin() : "");
        }

        return restTemplate.postForObject(
            executorUrl + "/execute",
            payload,
            ExecutionResponse.class
        );
    }
}