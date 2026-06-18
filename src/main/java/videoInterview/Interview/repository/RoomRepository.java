package videoInterview.Interview.repository;

import videoInterview.Interview.entity.Room;
import videoInterview.Interview.entity.Interview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;


import java.util.Optional;


public interface RoomRepository extends JpaRepository<Room, String> {

    // Find room by interview
    Optional<Room> findByInterview(Interview interview);

    // Find room by interview id directly
    Optional<Room> findByInterviewId(String interviewId);

    // Find active rooms — for admin dashboard later
    java.util.List<Room> findByStatus(Room.Status status);

    // Find room with interview eagerly loaded
    @Query("SELECT r FROM Room r LEFT JOIN FETCH r.interview WHERE r.id = :id")
    Optional<Room> findByIdWithInterview(@Param("id") String id);

    // Find room with question eagerly loaded
    @Query("SELECT r FROM Room r LEFT JOIN FETCH r.question WHERE r.id = :id")
    Optional<Room> findByIdWithQuestion(@Param("id") String id);

}