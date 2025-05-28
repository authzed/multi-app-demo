package com.example.docsservice;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@CrossOrigin(origins = "*")
public class DocumentController {

    @Autowired
    private DocumentRepository documentRepository;
    
    @Autowired
    private FolderRepository folderRepository;
    
    @Autowired
    private FolderService folderService;

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "healthy", "service", "docs");
    }

    // Folder endpoints
    @GetMapping("/folders/{folderId}")
    public ResponseEntity<Map<String, Object>> getFolderContents(@PathVariable UUID folderId,
                                                               @RequestHeader(value = "X-Username", required = false) String username) {
        if (username == null || username.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        Optional<Folder> folderOpt = folderRepository.findByIdAndViewer(folderId, username);
        if (folderOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Folder folder = folderOpt.get();
        List<Folder> subFolders = folderRepository.findByParentFolderIdAndViewer(folderId, username);
        List<Document> documents = documentRepository.findByFolderIdAndViewer(folderId, username);

        Map<String, Object> response = new java.util.HashMap<>();
        response.put("folder", folder);
        response.put("subFolders", subFolders);
        response.put("documents", documents);
        response.put("parentFolderId", folder.getParentFolder() != null ? folder.getParentFolder().getId() : null);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/folders/root")
    public ResponseEntity<Map<String, Object>> getRootFolderContents(@RequestHeader(value = "X-Username", required = false) String username) {
        if (username == null || username.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        Folder rootFolder = folderService.getRootFolder();
        
        // Add user as viewer if not already present
        if (!rootFolder.getViewers().contains(username)) {
            rootFolder.getViewers().add(username);
            folderRepository.save(rootFolder);
        }

        return getFolderContents(rootFolder.getId(), username);
    }

    @PostMapping("/folders")
    public ResponseEntity<Folder> createFolder(@RequestBody Map<String, Object> request,
                                             @RequestHeader(value = "X-Username", required = false) String username) {
        if (username == null || username.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        String name = (String) request.get("name");
        UUID parentFolderId = request.get("parentFolderId") != null ? 
            UUID.fromString(request.get("parentFolderId").toString()) : null;

        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        Folder parentFolder = null;
        if (parentFolderId != null) {
            Optional<Folder> parentOpt = folderRepository.findByIdAndViewer(parentFolderId, username);
            if (parentOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            parentFolder = parentOpt.get();
        } else {
            parentFolder = folderService.getRootFolder();
        }

        Folder newFolder = new Folder(name.trim(), username, parentFolder);
        return ResponseEntity.ok(folderRepository.save(newFolder));
    }

    // Document endpoints
    @PostMapping("/documents")
    public ResponseEntity<Document> createDocument(@RequestBody Map<String, Object> request,
                                                 @RequestHeader(value = "X-Username", required = false) String username) {
        if (username == null || username.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        String title = (String) request.get("title");
        String content = (String) request.get("content");
        UUID folderId = request.get("folderId") != null ? 
            UUID.fromString(request.get("folderId").toString()) : null;

        if (title == null || title.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        Folder folder = null;
        if (folderId != null) {
            Optional<Folder> folderOpt = folderRepository.findByIdAndViewer(folderId, username);
            if (folderOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            folder = folderOpt.get();
        } else {
            folder = folderService.getRootFolder();
        }

        Document document = new Document(title.trim(), content != null ? content : "", username, folder);
        return ResponseEntity.ok(documentRepository.save(document));
    }

    @GetMapping("/documents/{id}")
    public ResponseEntity<Document> getDocument(@PathVariable UUID id,
                                              @RequestHeader(value = "X-Username", required = false) String username) {
        if (username == null || username.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        Optional<Document> document = documentRepository.findByIdAndViewer(id, username);
        if (document.isPresent()) {
            return ResponseEntity.ok(document.get());
        }
        return ResponseEntity.notFound().build();
    }

    @PutMapping("/documents/{id}")
    public ResponseEntity<Document> updateDocument(@PathVariable UUID id,
                                                 @RequestBody Document updatedDocument,
                                                 @RequestHeader(value = "X-Username", required = false) String username) {
        if (username == null || username.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        Optional<Document> existingDocument = documentRepository.findByIdAndViewer(id, username);
        if (existingDocument.isPresent()) {
            Document document = existingDocument.get();
            document.setTitle(updatedDocument.getTitle());
            document.setContent(updatedDocument.getContent());
            return ResponseEntity.ok(documentRepository.save(document));
        }
        return ResponseEntity.notFound().build();
    }

    @DeleteMapping("/documents/{id}")
    public ResponseEntity<Void> deleteDocument(@PathVariable UUID id,
                                             @RequestHeader(value = "X-Username", required = false) String username) {
        if (username == null || username.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        Optional<Document> document = documentRepository.findByIdAndViewer(id, username);
        if (document.isPresent()) {
            documentRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    @DeleteMapping("/folders/{id}")
    public ResponseEntity<Void> deleteFolder(@PathVariable UUID id,
                                           @RequestHeader(value = "X-Username", required = false) String username) {
        if (username == null || username.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        Optional<Folder> folder = folderRepository.findByIdAndViewer(id, username);
        if (folder.isPresent() && !folder.get().getIsRoot()) {
            folderRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}