package videoInterview.Interview.dto.execution;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ExecutionResponse {
    private String stdout;
    private String stderr;
    private boolean passed;
    private boolean timedOut;
    private Integer executionTimeMs;   // ← Long → Integer
    private List<TestCaseResult> results;
    private String summary;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TestCaseResult {
        private String input;
        private String expectedOutput;
        private String actualOutput;
        private boolean passed;
        private String stderr;
        private Integer executionTimeMs;  // ← Long → Integer
    }
}