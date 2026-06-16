package videoInterview.Interview.repository;

import videoInterview.Interview.entity.TestCase;
import org.springframework.data.jpa.repository.JpaRepository;


import java.util.List;


public interface TestCaseRepository extends JpaRepository<TestCase, String> {

    // Get all test cases for a question
    List<TestCase> findByQuestionId(String questionId);

    // Get only visible test cases — shown to candidate
    List<TestCase> findByQuestionIdAndHiddenFalse(String questionId);

    // Get only hidden test cases — used by execution service
    List<TestCase> findByQuestionIdAndHiddenTrue(String questionId);

}