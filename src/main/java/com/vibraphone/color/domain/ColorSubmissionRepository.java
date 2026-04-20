package com.vibraphone.color.domain;

import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ColorSubmissionRepository extends JpaRepository<ColorSubmission, Long> {

    List<ColorSubmission> findByCreatedAtGreaterThanEqualOrderByCreatedAtDesc(Instant since);

    List<ColorSubmission> findByCreatedAtGreaterThanEqualOrderByCreatedAtDesc(Instant since, Pageable pageable);

    List<ColorSubmission> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @Query("select count(distinct submission.deviceId) from ColorSubmission submission where submission.createdAt >= :since")
    long countDistinctDeviceIdSince(@Param("since") Instant since);
}
