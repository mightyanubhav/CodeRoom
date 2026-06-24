package videoInterview.Interview.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import videoInterview.Interview.dto.execution.ExecutionRequest;
import videoInterview.Interview.dto.execution.ExecutionResponse;
import videoInterview.Interview.service.ExecutionService;

@RestController
@RequestMapping("/api/execute")
@RequiredArgsConstructor
public class ExecutionController {

    private final ExecutionService executionService;

    @PostMapping
    public ResponseEntity<ExecutionResponse> execute(
            @RequestBody ExecutionRequest request
    ) {
        ExecutionResponse response = executionService.execute(request);
        return ResponseEntity.ok(response);
    }
}