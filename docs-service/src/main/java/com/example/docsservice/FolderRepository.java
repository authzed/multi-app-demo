package com.example.docsservice;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface FolderRepository extends JpaRepository<Folder, Long> {
    Optional<Folder> findByIsRootTrue();
    
    List<Folder> findByParentFolderAndViewersContaining(Folder parentFolder, String viewer);
    
    @Query("SELECT f FROM Folder f WHERE f.parentFolder.id = :parentId AND :viewer MEMBER OF f.viewers")
    List<Folder> findByParentFolderIdAndViewer(@Param("parentId") Long parentId, @Param("viewer") String viewer);
    
    @Query("SELECT f FROM Folder f WHERE f.id = :folderId AND :viewer MEMBER OF f.viewers")
    Optional<Folder> findByIdAndViewer(@Param("folderId") Long folderId, @Param("viewer") String viewer);
}