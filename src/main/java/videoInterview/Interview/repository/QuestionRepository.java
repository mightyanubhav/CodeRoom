package videoInterview.Interview.repository;

import videoInterview.Interview.entity.Question;
import videoInterview.Interview.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;


import java.util.List;


public interface QuestionRepository extends JpaRepository<Question, String> {

    // Get all questions by difficulty
    List<Question> findByDifficulty(Question.Difficulty difficulty);

    // Get all questions created by a specific interviewer
    List<Question> findByCreatedBy(User createdBy);

    // Search questions by title — case insensitive
    List<Question> findByTitleContainingIgnoreCase(String keyword);

    // Get all questions by difficulty ordered by creation date
    List<Question> findByDifficultyOrderByCreatedAtDesc(Question.Difficulty difficulty);

    // Search by tag — since tags is a comma separated string
    @Query("SELECT q FROM Question q WHERE q.tags LIKE %:tag%")
    List<Question> findByTag(@Param("tag") String tag);

    // Get all questions with test cases eagerly loaded
    @Query("SELECT DISTINCT q FROM Question q LEFT JOIN FETCH q.testCases WHERE q.id = :id")
    java.util.Optional<Question> findByIdWithTestCases(@Param("id") String id);

}