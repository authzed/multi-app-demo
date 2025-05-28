package com.example.docsservice;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface DocumentRepository extends JpaRepository<Document, Long> {
    List<Document> findByOwner(String owner);
    List<Document> findByTitleContainingIgnoreCase(String title);
    
    @Query("SELECT d FROM Document d WHERE d.folder.id = :folderId AND :viewer MEMBER OF d.viewers")
    List<Document> findByFolderIdAndViewer(@Param("folderId") Long folderId, @Param("viewer") String viewer);
    
    @Query("SELECT d FROM Document d WHERE d.id = :documentId AND :viewer MEMBER OF d.viewers")
    Optional<Document> findByIdAndViewer(@Param("documentId") Long documentId, @Param("viewer") String viewer);
}