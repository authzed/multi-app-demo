package com.example.docsservice;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.ArrayList;
import java.util.HashMap;

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

        try {
            Optional<Folder> folderOpt = folderRepository.findById(folderId);
            if (folderOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            Folder folder = folderOpt.get();
            
            // Get all subfolders and filter by permissions
            List<Folder> allSubFolders = folderRepository.findByParentFolderId(folderId);

            // Get all documents and filter by permissions
            List<Document> allDocuments = documentRepository.findByFolderId(folderId);

            Map<String, Object> response = new java.util.HashMap<>();
            response.put("folder", folder);
            response.put("subFolders", allSubFolders);
            response.put("documents", allDocuments);
            response.put("parentFolderId", folder.getParentFolder() != null ? folder.getParentFolder().getId() : null);
            response.put("isOwner", true);
            response.put("isEditor", true);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }
    }

    @GetMapping("/folders/root")
    public ResponseEntity<Map<String, Object>> getRootFolderContents(@RequestHeader(value = "X-Username", required = false) String username) {
        if (username == null || username.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        Folder rootFolder = folderService.getRootFolder();
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

        try {
            Folder parentFolder = null;
            if (parentFolderId != null) {
                Optional<Folder> parentOpt = folderRepository.findById(parentFolderId);
                if (parentOpt.isEmpty()) {
                    return ResponseEntity.notFound().build();
                }
                parentFolder = parentOpt.get();
            } else {
                parentFolder = folderService.getRootFolder();
            }

            Folder newFolder = new Folder(name.trim(), parentFolder);
            Folder savedFolder = folderRepository.save(newFolder);
            
            folderRepository.save(savedFolder);
            
            return ResponseEntity.ok(savedFolder);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }
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

        try {
            Folder folder = null;
            if (folderId != null) {
                Optional<Folder> folderOpt = folderRepository.findById(folderId);
                if (folderOpt.isEmpty()) {
                    return ResponseEntity.notFound().build();
                }
                folder = folderOpt.get();
            } else {
                folder = folderService.getRootFolder();
            }

            Document document = new Document(title.trim(), content != null ? content : "", folder);
            Document savedDocument = documentRepository.save(document);
            
            documentRepository.save(savedDocument);
            
            return ResponseEntity.ok(savedDocument);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }
    }

    @GetMapping("/documents/{id}")
    public ResponseEntity<Document> getDocument(@PathVariable UUID id,
                                              @RequestHeader(value = "X-Username", required = false) String username) {
        if (username == null || username.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        try {
            Optional<Document> documentOpt = documentRepository.findByIdWithFolder(id);
            if (!documentOpt.isPresent()) {
                return ResponseEntity.notFound().build();
            }
            
            Document document = documentOpt.get();
            
            List<String> owners = new ArrayList<>();
            owners.add(username);

            document.setOwners(owners);
            return ResponseEntity.ok(document);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }
    }

    @PutMapping("/documents/{id}")
    public ResponseEntity<Document> updateDocument(@PathVariable UUID id,
                                                 @RequestBody Document updatedDocument,
                                                 @RequestHeader(value = "X-Username", required = false) String username) {
        if (username == null || username.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        try {
            Optional<Document> existingDocument = documentRepository.findByIdWithFolder(id);
            if (!existingDocument.isPresent()) {
                return ResponseEntity.notFound().build();
            }

            Document document = existingDocument.get();
            
            // Document was already retrieved above
            document.setTitle(updatedDocument.getTitle());
            document.setContent(updatedDocument.getContent());
            return ResponseEntity.ok(documentRepository.save(document));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }
    }

    @DeleteMapping("/documents/{id}")
    public ResponseEntity<Void> deleteDocument(@PathVariable UUID id,
                                             @RequestHeader(value = "X-Username", required = false) String username) {
        if (username == null || username.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        try {
            Optional<Document> documentOpt = documentRepository.findByIdWithFolder(id);
            if (!documentOpt.isPresent()) {
                return ResponseEntity.notFound().build();
            }
            
            Document document = documentOpt.get();
            
            // Document was already retrieved above
            documentRepository.deleteById(id);
            
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }
    }

    @DeleteMapping("/folders/{id}")
    public ResponseEntity<Void> deleteFolder(@PathVariable UUID id,
                                           @RequestHeader(value = "X-Username", required = false) String username) {
        if (username == null || username.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        try {
            Optional<Folder> folder = folderRepository.findById(id);
            if (folder.isPresent() && !folder.get().getIsRoot()) {
                folderRepository.deleteById(id);
                
                return ResponseEntity.noContent().build();
            }
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }
    }
    
    // Sharing endpoints
    @GetMapping("/documents/{id}/shares")
    public ResponseEntity<Map<String, Object>> getDocumentShares(@PathVariable UUID id,
                                                               @RequestHeader(value = "X-Username", required = false) String username) {
        if (username == null || username.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        try {
            List<Map<String, String>> shares = new ArrayList<>();
            Map<String, Object> result = new HashMap<>();
            result.put("shares", shares);
            result.put("resourceType", "document");
            result.put("resourceId", id.toString());

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }

    }

    @GetMapping("/folders/{id}/shares")
    public ResponseEntity<Map<String, Object>> getFolderShares(@PathVariable UUID id,
                                                             @RequestHeader(value = "X-Username", required = false) String username) {
        if (username == null || username.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        try {
            List<Map<String, String>> shares = new ArrayList<>();

            Map<String, Object> result = new HashMap<>();
            result.put("shares", shares);
            result.put("resourceType", "folder");
            result.put("resourceId", id.toString());

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }
    }

    @PostMapping("/shares")
    public ResponseEntity<Map<String, String>> updateShares(@RequestBody Map<String, Object> request,
                                                           @RequestHeader(value = "X-Username", required = false) String username) {
        if (username == null || username.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        try {
            String resourceType = (String) request.get("resourceType");
            String resourceId = (String) request.get("resourceId");


            if ("document".equals(resourceType)) {
                Optional<Document> docOpt = documentRepository.findById(UUID.fromString(resourceId));
                if (docOpt.isPresent()) {
                    Document doc = docOpt.get();
                    documentRepository.save(doc);
                }
            } else if ("folder".equals(resourceType)) {
                Optional<Folder> folderOpt = folderRepository.findById(UUID.fromString(resourceId));
                if (folderOpt.isPresent()) {
                    Folder folder = folderOpt.get();
                    folderRepository.save(folder);
                }
            }

            return ResponseEntity.ok(Map.of("status", "success"));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }
    }
}