package videoInterview.Interview.dto.execution;

import lombok.Getter;
import lombok.Setter;
import java.util.List;

@Getter
@Setter
public class ExecutionResponse {
    private String stdout;
    private String stderr;
    private boolean passed;
    private boolean timedOut;
    private long executionTimeMs;
    private List<TestCaseResult> results;

    @Getter
    @Setter
    public static class TestCaseResult {
        private String input;
        private String expectedOutput;
        private String actualOutput;
        private boolean passed;
        private long executionTimeMs;
    }
}