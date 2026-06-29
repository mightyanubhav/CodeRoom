package videoInterview.Interview.dto.execution;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import java.util.List;

@Getter
@JsonIgnoreProperties(ignoreUnknown = true)
public class ExecutionRequest {
    private String code;
    private String language;
    private String questionId;
    private String roomId;
    private String stdin;
    private boolean submitAll = false;
    private List<TestCaseDto> testCases;

    @Getter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TestCaseDto {
        private String input;
        private String expectedOutput;
        private boolean hidden;
    }
}