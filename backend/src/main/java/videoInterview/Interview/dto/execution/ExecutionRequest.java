package videoInterview.Interview.dto.execution;

import lombok.Getter;
import java.util.List;

@Getter
public class ExecutionRequest {
    private String code;
    private String language;
    private String questionId;
    private String roomId;
    private String stdin;
    private List<TestCaseDto> testCases;

    @Getter
    public static class TestCaseDto {
        private String input;
        private String expectedOutput;
        private boolean hidden;
    }
}