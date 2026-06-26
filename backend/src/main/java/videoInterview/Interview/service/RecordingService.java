package videoInterview.Interview.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import videoInterview.Interview.entity.Interview;
import videoInterview.Interview.repository.InterviewRepository;

import java.io.IOException;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RecordingService {

    private final S3Client s3Client;
    private final InterviewRepository interviewRepository;

    @Value("${r2.bucket.name}")
    private String bucketName;

    @Value("${r2.public.url}")
    private String publicUrl;

    public String uploadRecording(String interviewId, MultipartFile file) throws IOException {

        // Generate unique filename
        String filename = "recordings/" + interviewId + "/" +
                UUID.randomUUID() + ".webm";

        // Upload to R2
        PutObjectRequest putRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(filename)
                .contentType("video/webm")
                .contentLength(file.getSize())
                .build();

        s3Client.putObject(
                putRequest,
                RequestBody.fromInputStream(file.getInputStream(), file.getSize())
        );

        // Build public URL
        String recordingUrl = publicUrl + "/" + filename;

        // Save URL to interview
        Interview interview = interviewRepository.findById(interviewId)
                .orElseThrow(() -> new RuntimeException("Interview not found"));
        interview.setRecordingUrl(recordingUrl);
        interviewRepository.save(interview);

        return recordingUrl;
    }
}