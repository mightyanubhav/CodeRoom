package videoInterview.Interview.repository;

import videoInterview.Interview.entity.Interview;
import videoInterview.Interview.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;


public interface InterviewRepository extends JpaRepository<Interview, String> {

    // Get all interviews for an interviewer
    List<Interview> findByInterviewer(User interviewer);

    // Get all interviews for a candidate
    List<Interview> findByCandidate(User candidate);

    // Get all interviews by status — e.g. all SCHEDULED ones
    List<Interview> findByStatus(Interview.Status status);

    // Get all interviews for an interviewer filtered by status
    List<Interview> findByInterviewerAndStatus(User interviewer, Interview.Status status);

    // Find by unique room link
    Optional<Interview> findByRoomId(String roomId);

    // Get all interviews for an interviewer — ordered by scheduled time
    List<Interview> findByInterviewerOrderByScheduledAtDesc(User interviewer);

    // Custom query — get all completed interviews with a score
    @Query("SELECT i FROM Interview i WHERE i.interviewer = :interviewer AND i.score IS NOT NULL")
    List<Interview> findScoredInterviews(@Param("interviewer") User interviewer);

}