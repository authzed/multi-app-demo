package com.example.docsservice;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.stereotype.Component;
import jakarta.annotation.PreDestroy;
import jakarta.annotation.PostConstruct;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.ArrayList;
import java.util.HashMap;

import com.authzed.api.v1.*;
import com.authzed.grpcutil.BearerToken;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;

@RestController
@CrossOrigin(origins = "*")
public class DocumentController {

    @Autowired
    private DocumentRepository documentRepository;
    
    @Autowired
    private FolderRepository folderRepository;
    
    @Autowired
    private FolderService folderService;
    
    private ManagedChannel spiceDBChannel;
    private BearerToken bearerToken;
    
    @PostConstruct
    private void initializeSpiceDBConnection() {
        String endpoint = System.getenv().getOrDefault("SPICEDB_ENDPOINT", "localhost:50051");
        String token = System.getenv().getOrDefault("SPICEDB_TOKEN", "testtesttesttest");
        
        this.spiceDBChannel = ManagedChannelBuilder.forTarget(endpoint)
                .usePlaintext()
                .build();
        this.bearerToken = new BearerToken(token);
    }
    
    @PreDestroy
    private void shutdownSpiceDBConnection() {
        if (spiceDBChannel != null && !spiceDBChannel.isShutdown()) {
            spiceDBChannel.shutdown();
        }
    }
    
    private PermissionsServiceGrpc.PermissionsServiceBlockingStub getPermissionsClient() {
        return PermissionsServiceGrpc.newBlockingStub(spiceDBChannel)
                .withCallCredentials(bearerToken);
    }
    
    private SchemaServiceGrpc.SchemaServiceBlockingStub getSchemaClient() {
        return SchemaServiceGrpc.newBlockingStub(spiceDBChannel)
                .withCallCredentials(bearerToken);
    }
    
    private CheckPermissionRequest.Builder buildPermissionCheck(String resourceType, String resourceId, String permission, String username) {
        return CheckPermissionRequest.newBuilder()
                .setResource(ObjectReference.newBuilder()
                        .setObjectType(resourceType)
                        .setObjectId(resourceId)
                        .build())
                .setPermission(permission)
                .setSubject(SubjectReference.newBuilder()
                        .setObject(ObjectReference.newBuilder()
                                .setObjectType("user")
                                .setObjectId(username)
                                .build())
                        .build());
    }
    
    private CheckPermissionRequest buildPermissionCheckWithZedtoken(String resourceType, String resourceId, String permission, String username, String zedtoken) {
        CheckPermissionRequest.Builder builder = buildPermissionCheck(resourceType, resourceId, permission, username);
        if (zedtoken != null && !zedtoken.isEmpty()) {
            builder.setConsistency(Consistency.newBuilder()
                    .setAtLeastAsFresh(ZedToken.newBuilder()
                            .setToken(zedtoken)
                            .build())
                    .build());
        }
        return builder.build();
    }

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
            PermissionsServiceGrpc.PermissionsServiceBlockingStub permClient = getPermissionsClient();
            
            // Get folder from database first to get its zedtoken
            Optional<Folder> folderOpt = folderRepository.findById(folderId);
            if (folderOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            Folder folder = folderOpt.get();
            
            // Check if user can view this folder with zedtoken consistency
            CheckPermissionRequest folderPermRequest = buildPermissionCheckWithZedtoken("folder", folderId.toString(), "view", username, folder.getZedtoken());
            CheckPermissionResponse folderPermResponse = permClient.checkPermission(folderPermRequest);
            if (folderPermResponse.getPermissionship() != CheckPermissionResponse.Permissionship.PERMISSIONSHIP_HAS_PERMISSION) {
                return ResponseEntity.status(403).build();
            }

            
            // Check if user is owner of this folder
            CheckPermissionRequest ownerPermRequest = buildPermissionCheckWithZedtoken("folder", folderId.toString(), "delete", username, folder.getZedtoken());
            CheckPermissionResponse ownerPermResponse = permClient.checkPermission(ownerPermRequest);
            boolean isOwner = ownerPermResponse.getPermissionship() == CheckPermissionResponse.Permissionship.PERMISSIONSHIP_HAS_PERMISSION;
            
            // Check if user is editor of this folder
            CheckPermissionRequest editorPermRequest = buildPermissionCheckWithZedtoken("folder", folderId.toString(), "create_content", username, folder.getZedtoken());
            CheckPermissionResponse editorPermResponse = permClient.checkPermission(editorPermRequest);
            boolean isEditor = editorPermResponse.getPermissionship() == CheckPermissionResponse.Permissionship.PERMISSIONSHIP_HAS_PERMISSION;

            // Get all subfolders and filter by permissions
            List<Folder> allSubFolders = folderRepository.findByParentFolderId(folderId);
            List<Folder> viewableSubFolders = new ArrayList<>();
            
            for (Folder subFolder : allSubFolders) {
                CheckPermissionRequest subFolderPermRequest = buildPermissionCheckWithZedtoken("folder", subFolder.getId().toString(), "view", username, subFolder.getZedtoken());
                CheckPermissionResponse subFolderPermResponse = permClient.checkPermission(subFolderPermRequest);
                if (subFolderPermResponse.getPermissionship() == CheckPermissionResponse.Permissionship.PERMISSIONSHIP_HAS_PERMISSION) {
                    viewableSubFolders.add(subFolder);
                }
            }
            
            // Get all documents and filter by permissions
            List<Document> allDocuments = documentRepository.findByFolderId(folderId);
            List<Document> viewableDocuments = new ArrayList<>();
            
            for (Document document : allDocuments) {
                CheckPermissionRequest docPermRequest = buildPermissionCheckWithZedtoken("document", document.getId().toString(), "view", username, document.getZedtoken());
                CheckPermissionResponse docPermResponse = permClient.checkPermission(docPermRequest);
                if (docPermResponse.getPermissionship() == CheckPermissionResponse.Permissionship.PERMISSIONSHIP_HAS_PERMISSION) {
                    viewableDocuments.add(document);
                }
            }

            Map<String, Object> response = new java.util.HashMap<>();
            response.put("folder", folder);
            response.put("subFolders", viewableSubFolders);
            response.put("documents", viewableDocuments);
            response.put("parentFolderId", folder.getParentFolder() != null ? folder.getParentFolder().getId() : null);
            response.put("isOwner", isOwner);
            response.put("isEditor", isEditor);

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
            PermissionsServiceGrpc.PermissionsServiceBlockingStub permClient = getPermissionsClient();
            
            Folder parentFolder = null;
            if (parentFolderId != null) {
                // Check if user can create content in parent folder
                CheckPermissionRequest parentPermRequest = CheckPermissionRequest.newBuilder()
                        .setResource(ObjectReference.newBuilder()
                                .setObjectType("folder")
                                .setObjectId(parentFolderId.toString())
                                .build())
                        .setPermission("create_content")
                        .setSubject(SubjectReference.newBuilder()
                                .setObject(ObjectReference.newBuilder()
                                        .setObjectType("user")
                                        .setObjectId(username)
                                        .build())
                                .build())
                        .build();

                CheckPermissionResponse parentPermResponse = permClient.checkPermission(parentPermRequest);
                if (parentPermResponse.getPermissionship() != CheckPermissionResponse.Permissionship.PERMISSIONSHIP_HAS_PERMISSION) {
                    return ResponseEntity.status(403).build();
                }
                
                Optional<Folder> parentOpt = folderRepository.findById(parentFolderId);
                if (parentOpt.isEmpty()) {
                    return ResponseEntity.notFound().build();
                }
                parentFolder = parentOpt.get();
            } else {
                parentFolder = folderService.getRootFolder();
                
                // Check if user can create content in root folder
                CheckPermissionRequest rootPermRequest = CheckPermissionRequest.newBuilder()
                        .setResource(ObjectReference.newBuilder()
                                .setObjectType("folder")
                                .setObjectId(parentFolder.getId().toString())
                                .build())
                        .setPermission("create_content")
                        .setSubject(SubjectReference.newBuilder()
                                .setObject(ObjectReference.newBuilder()
                                        .setObjectType("user")
                                        .setObjectId(username)
                                        .build())
                                .build())
                        .build();

                CheckPermissionResponse rootPermResponse = permClient.checkPermission(rootPermRequest);
                if (rootPermResponse.getPermissionship() != CheckPermissionResponse.Permissionship.PERMISSIONSHIP_HAS_PERMISSION) {
                    return ResponseEntity.status(403).build();
                }
            }

            Folder newFolder = new Folder(name.trim(), parentFolder);
            Folder savedFolder = folderRepository.save(newFolder);
            
            // Create ownership relationship in SpiceDB
            WriteRelationshipsRequest writeRequest = WriteRelationshipsRequest.newBuilder()
                    .addUpdates(RelationshipUpdate.newBuilder()
                            .setOperation(RelationshipUpdate.Operation.OPERATION_CREATE)
                            .setRelationship(Relationship.newBuilder()
                                    .setResource(ObjectReference.newBuilder()
                                            .setObjectType("folder")
                                            .setObjectId(savedFolder.getId().toString())
                                            .build())
                                    .setRelation("owner")
                                    .setSubject(SubjectReference.newBuilder()
                                            .setObject(ObjectReference.newBuilder()
                                                    .setObjectType("user")
                                                    .setObjectId(username)
                                                    .build())
                                            .build())
                                    .build())
                            .build())
                    .build();
            
            WriteRelationshipsResponse writeResponse = permClient.writeRelationships(writeRequest);
            
            // Store the zedtoken for read-after-write consistency
            String zedtoken = writeResponse.getWrittenAt().getToken();
            savedFolder.setZedtoken(zedtoken);
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
            PermissionsServiceGrpc.PermissionsServiceBlockingStub permClient = getPermissionsClient();
            
            Folder folder = null;
            if (folderId != null) {
                // Get folder first to access its zedtoken
                Optional<Folder> folderOpt = folderRepository.findById(folderId);
                if (folderOpt.isEmpty()) {
                    return ResponseEntity.notFound().build();
                }
                folder = folderOpt.get();
                
                // Check if user can create content in this folder with zedtoken consistency
                CheckPermissionRequest folderPermRequest = buildPermissionCheckWithZedtoken("folder", folderId.toString(), "create_content", username, folder.getZedtoken());
                CheckPermissionResponse folderPermResponse = permClient.checkPermission(folderPermRequest);
                if (folderPermResponse.getPermissionship() != CheckPermissionResponse.Permissionship.PERMISSIONSHIP_HAS_PERMISSION) {
                    return ResponseEntity.status(403).build();
                }
            } else {
                folder = folderService.getRootFolder();
                
                // Check if user can create content in root folder with zedtoken consistency
                CheckPermissionRequest rootPermRequest = buildPermissionCheckWithZedtoken("folder", folder.getId().toString(), "create_content", username, folder.getZedtoken());
                CheckPermissionResponse rootPermResponse = permClient.checkPermission(rootPermRequest);
                if (rootPermResponse.getPermissionship() != CheckPermissionResponse.Permissionship.PERMISSIONSHIP_HAS_PERMISSION) {
                    return ResponseEntity.status(403).build();
                }
            }

            Document document = new Document(title.trim(), content != null ? content : "", folder);
            Document savedDocument = documentRepository.save(document);
            
            // Create ownership relationship in SpiceDB
            WriteRelationshipsRequest writeRequest = WriteRelationshipsRequest.newBuilder()
                    .addUpdates(RelationshipUpdate.newBuilder()
                            .setOperation(RelationshipUpdate.Operation.OPERATION_CREATE)
                            .setRelationship(Relationship.newBuilder()
                                    .setResource(ObjectReference.newBuilder()
                                            .setObjectType("document")
                                            .setObjectId(savedDocument.getId().toString())
                                            .build())
                                    .setRelation("owner")
                                    .setSubject(SubjectReference.newBuilder()
                                            .setObject(ObjectReference.newBuilder()
                                                    .setObjectType("user")
                                                    .setObjectId(username)
                                                    .build())
                                            .build())
                                    .build())
                            .build())
                    .build();
            
            WriteRelationshipsResponse writeResponse = permClient.writeRelationships(writeRequest);
            
            // Store the zedtoken for read-after-write consistency
            String zedtoken = writeResponse.getWrittenAt().getToken();
            savedDocument.setZedtoken(zedtoken);
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
            PermissionsServiceGrpc.PermissionsServiceBlockingStub permClient = getPermissionsClient();
            
            // Check if user can view this document
            CheckPermissionRequest permRequest = CheckPermissionRequest.newBuilder()
                    .setResource(ObjectReference.newBuilder()
                            .setObjectType("document")
                            .setObjectId(id.toString())
                            .build())
                    .setPermission("view")
                    .setSubject(SubjectReference.newBuilder()
                            .setObject(ObjectReference.newBuilder()
                                    .setObjectType("user")
                                    .setObjectId(username)
                                    .build())
                            .build())
                    .build();

            CheckPermissionResponse permResponse = permClient.checkPermission(permRequest);
            if (permResponse.getPermissionship() != CheckPermissionResponse.Permissionship.PERMISSIONSHIP_HAS_PERMISSION) {
                return ResponseEntity.status(403).build();
            }

            Optional<Document> documentOpt = documentRepository.findByIdWithFolder(id);
            if (documentOpt.isPresent()) {
                Document document = documentOpt.get();
                
                // Read owner relationships from SpiceDB
                ReadRelationshipsRequest readRequest = ReadRelationshipsRequest.newBuilder()
                        .setRelationshipFilter(RelationshipFilter.newBuilder()
                                .setResourceType("document")
                                .setOptionalResourceId(id.toString())
                                .setOptionalRelation("owner")
                                .build())
                        .build();

                List<String> owners = new ArrayList<>();
                permClient.readRelationships(readRequest).forEachRemaining(response -> {
                    Relationship rel = response.getRelationship();
                    if ("owner".equals(rel.getRelation())) {
                        owners.add(rel.getSubject().getObject().getObjectId());
                    }
                });
                
                document.setOwners(owners);
                return ResponseEntity.ok(document);
            }
            return ResponseEntity.notFound().build();
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
            PermissionsServiceGrpc.PermissionsServiceBlockingStub permClient = getPermissionsClient();
            
            // Check if user can edit this document
            CheckPermissionRequest permRequest = CheckPermissionRequest.newBuilder()
                    .setResource(ObjectReference.newBuilder()
                            .setObjectType("document")
                            .setObjectId(id.toString())
                            .build())
                    .setPermission("edit")
                    .setSubject(SubjectReference.newBuilder()
                            .setObject(ObjectReference.newBuilder()
                                    .setObjectType("user")
                                    .setObjectId(username)
                                    .build())
                            .build())
                    .build();

            CheckPermissionResponse permResponse = permClient.checkPermission(permRequest);
            if (permResponse.getPermissionship() != CheckPermissionResponse.Permissionship.PERMISSIONSHIP_HAS_PERMISSION) {
                return ResponseEntity.status(403).build();
            }

            Optional<Document> existingDocument = documentRepository.findByIdWithFolder(id);
            if (existingDocument.isPresent()) {
                Document document = existingDocument.get();
                document.setTitle(updatedDocument.getTitle());
                document.setContent(updatedDocument.getContent());
                return ResponseEntity.ok(documentRepository.save(document));
            }
            return ResponseEntity.notFound().build();
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
            PermissionsServiceGrpc.PermissionsServiceBlockingStub permClient = getPermissionsClient();
            
            // Check if user can delete this document
            CheckPermissionRequest permRequest = CheckPermissionRequest.newBuilder()
                    .setResource(ObjectReference.newBuilder()
                            .setObjectType("document")
                            .setObjectId(id.toString())
                            .build())
                    .setPermission("delete")
                    .setSubject(SubjectReference.newBuilder()
                            .setObject(ObjectReference.newBuilder()
                                    .setObjectType("user")
                                    .setObjectId(username)
                                    .build())
                            .build())
                    .build();

            CheckPermissionResponse permResponse = permClient.checkPermission(permRequest);
            if (permResponse.getPermissionship() != CheckPermissionResponse.Permissionship.PERMISSIONSHIP_HAS_PERMISSION) {
                return ResponseEntity.status(403).build();
            }

            Optional<Document> document = documentRepository.findByIdWithFolder(id);
            if (document.isPresent()) {
                documentRepository.deleteById(id);
                
                // Clean up SpiceDB relationships for this document
                ReadRelationshipsRequest readRequest = ReadRelationshipsRequest.newBuilder()
                        .setRelationshipFilter(RelationshipFilter.newBuilder()
                                .setResourceType("document")
                                .setOptionalResourceId(id.toString())
                                .build())
                        .build();

                WriteRelationshipsRequest.Builder writeRequestBuilder = WriteRelationshipsRequest.newBuilder();
                
                permClient.readRelationships(readRequest).forEachRemaining(response -> {
                    Relationship rel = response.getRelationship();
                    RelationshipUpdate update = RelationshipUpdate.newBuilder()
                            .setOperation(RelationshipUpdate.Operation.OPERATION_DELETE)
                            .setRelationship(rel)
                            .build();
                    writeRequestBuilder.addUpdates(update);
                });
                
                if (writeRequestBuilder.getUpdatesCount() > 0) {
                    permClient.writeRelationships(writeRequestBuilder.build());
                }
                
                return ResponseEntity.noContent().build();
            }
            return ResponseEntity.notFound().build();
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
            PermissionsServiceGrpc.PermissionsServiceBlockingStub permClient = getPermissionsClient();
            
            // Check if user can delete this folder
            CheckPermissionRequest permRequest = CheckPermissionRequest.newBuilder()
                    .setResource(ObjectReference.newBuilder()
                            .setObjectType("folder")
                            .setObjectId(id.toString())
                            .build())
                    .setPermission("delete")
                    .setSubject(SubjectReference.newBuilder()
                            .setObject(ObjectReference.newBuilder()
                                    .setObjectType("user")
                                    .setObjectId(username)
                                    .build())
                            .build())
                    .build();

            CheckPermissionResponse permResponse = permClient.checkPermission(permRequest);
            if (permResponse.getPermissionship() != CheckPermissionResponse.Permissionship.PERMISSIONSHIP_HAS_PERMISSION) {
                return ResponseEntity.status(403).build();
            }

            Optional<Folder> folder = folderRepository.findById(id);
            if (folder.isPresent() && !folder.get().getIsRoot()) {
                folderRepository.deleteById(id);
                
                // Clean up SpiceDB relationships for this folder
                ReadRelationshipsRequest readRequest = ReadRelationshipsRequest.newBuilder()
                        .setRelationshipFilter(RelationshipFilter.newBuilder()
                                .setResourceType("folder")
                                .setOptionalResourceId(id.toString())
                                .build())
                        .build();

                WriteRelationshipsRequest.Builder writeRequestBuilder = WriteRelationshipsRequest.newBuilder();
                
                permClient.readRelationships(readRequest).forEachRemaining(response -> {
                    Relationship rel = response.getRelationship();
                    RelationshipUpdate update = RelationshipUpdate.newBuilder()
                            .setOperation(RelationshipUpdate.Operation.OPERATION_DELETE)
                            .setRelationship(rel)
                            .build();
                    writeRequestBuilder.addUpdates(update);
                });
                
                if (writeRequestBuilder.getUpdatesCount() > 0) {
                    permClient.writeRelationships(writeRequestBuilder.build());
                }
                
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
            PermissionsServiceGrpc.PermissionsServiceBlockingStub permClient = getPermissionsClient();
            
            // Check if user can manage sharing for this document
            CheckPermissionRequest permRequest = CheckPermissionRequest.newBuilder()
                    .setResource(ObjectReference.newBuilder()
                            .setObjectType("document")
                            .setObjectId(id.toString())
                            .build())
                    .setPermission("manage_sharing")
                    .setSubject(SubjectReference.newBuilder()
                            .setObject(ObjectReference.newBuilder()
                                    .setObjectType("user")
                                    .setObjectId(username)
                                    .build())
                            .build())
                    .build();

            CheckPermissionResponse permResponse = permClient.checkPermission(permRequest);
            if (permResponse.getPermissionship() != CheckPermissionResponse.Permissionship.PERMISSIONSHIP_HAS_PERMISSION) {
                return ResponseEntity.status(403).build();
            }

            // Read existing relationships for this document
            ReadRelationshipsRequest readRequest = ReadRelationshipsRequest.newBuilder()
                    .setRelationshipFilter(RelationshipFilter.newBuilder()
                            .setResourceType("document")
                            .setOptionalResourceId(id.toString())
                            .build())
                    .build();

            List<Map<String, String>> shares = new ArrayList<>();
            permClient.readRelationships(readRequest).forEachRemaining(response -> {
                Relationship rel = response.getRelationship();
                Map<String, String> share = new HashMap<>();
                share.put("username", rel.getSubject().getObject().getObjectId());
                share.put("role", rel.getRelation());
                shares.add(share);
            });

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
            PermissionsServiceGrpc.PermissionsServiceBlockingStub permClient = getPermissionsClient();
            
            // Check if user can manage sharing for this folder
            CheckPermissionRequest permRequest = CheckPermissionRequest.newBuilder()
                    .setResource(ObjectReference.newBuilder()
                            .setObjectType("folder")
                            .setObjectId(id.toString())
                            .build())
                    .setPermission("manage_sharing")
                    .setSubject(SubjectReference.newBuilder()
                            .setObject(ObjectReference.newBuilder()
                                    .setObjectType("user")
                                    .setObjectId(username)
                                    .build())
                            .build())
                    .build();

            CheckPermissionResponse permResponse = permClient.checkPermission(permRequest);
            if (permResponse.getPermissionship() != CheckPermissionResponse.Permissionship.PERMISSIONSHIP_HAS_PERMISSION) {
                return ResponseEntity.status(403).build();
            }

            // Read existing relationships for this folder
            ReadRelationshipsRequest readRequest = ReadRelationshipsRequest.newBuilder()
                    .setRelationshipFilter(RelationshipFilter.newBuilder()
                            .setResourceType("folder")
                            .setOptionalResourceId(id.toString())
                            .build())
                    .build();

            List<Map<String, String>> shares = new ArrayList<>();
            permClient.readRelationships(readRequest).forEachRemaining(response -> {
                Relationship rel = response.getRelationship();
                Map<String, String> share = new HashMap<>();
                share.put("username", rel.getSubject().getObject().getObjectId());
                share.put("role", rel.getRelation());
                shares.add(share);
            });

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
            PermissionsServiceGrpc.PermissionsServiceBlockingStub permClient = getPermissionsClient();
            String resourceType = (String) request.get("resourceType");
            String resourceId = (String) request.get("resourceId");
            @SuppressWarnings("unchecked")
            List<Map<String, String>> toAdd = (List<Map<String, String>>) request.get("toAdd");
            @SuppressWarnings("unchecked")
            List<Map<String, String>> toRemove = (List<Map<String, String>>) request.get("toRemove");

            // Check if user can manage sharing for this resource
            CheckPermissionRequest permRequest = CheckPermissionRequest.newBuilder()
                    .setResource(ObjectReference.newBuilder()
                            .setObjectType(resourceType)
                            .setObjectId(resourceId)
                            .build())
                    .setPermission("manage_sharing")
                    .setSubject(SubjectReference.newBuilder()
                            .setObject(ObjectReference.newBuilder()
                                    .setObjectType("user")
                                    .setObjectId(username)
                                    .build())
                            .build())
                    .build();

            CheckPermissionResponse permResponse = permClient.checkPermission(permRequest);
            if (permResponse.getPermissionship() != CheckPermissionResponse.Permissionship.PERMISSIONSHIP_HAS_PERMISSION) {
                return ResponseEntity.status(403).build();
            }

            // Build write request with updates
            WriteRelationshipsRequest.Builder writeRequestBuilder = WriteRelationshipsRequest.newBuilder();

            // Add new relationships
            if (toAdd != null) {
                for (Map<String, String> share : toAdd) {
                    String shareUsername = share.get("username");
                    String role = share.get("role");
                    
                    RelationshipUpdate update = RelationshipUpdate.newBuilder()
                            .setOperation(RelationshipUpdate.Operation.OPERATION_CREATE)
                            .setRelationship(Relationship.newBuilder()
                                    .setResource(ObjectReference.newBuilder()
                                            .setObjectType(resourceType)
                                            .setObjectId(resourceId)
                                            .build())
                                    .setRelation(role)
                                    .setSubject(SubjectReference.newBuilder()
                                            .setObject(ObjectReference.newBuilder()
                                                    .setObjectType("user")
                                                    .setObjectId(shareUsername)
                                                    .build())
                                            .build())
                                    .build())
                            .build();
                    writeRequestBuilder.addUpdates(update);
                }
            }

            // Remove relationships
            if (toRemove != null) {
                for (Map<String, String> share : toRemove) {
                    String shareUsername = share.get("username");
                    String role = share.get("role");
                    
                    RelationshipUpdate update = RelationshipUpdate.newBuilder()
                            .setOperation(RelationshipUpdate.Operation.OPERATION_DELETE)
                            .setRelationship(Relationship.newBuilder()
                                    .setResource(ObjectReference.newBuilder()
                                            .setObjectType(resourceType)
                                            .setObjectId(resourceId)
                                            .build())
                                    .setRelation(role)
                                    .setSubject(SubjectReference.newBuilder()
                                            .setObject(ObjectReference.newBuilder()
                                                    .setObjectType("user")
                                                    .setObjectId(shareUsername)
                                                    .build())
                                            .build())
                                    .build())
                            .build();
                    writeRequestBuilder.addUpdates(update);
                }
            }

            // Execute the write request if there are updates
            if (writeRequestBuilder.getUpdatesCount() > 0) {
                WriteRelationshipsResponse writeResponse = permClient.writeRelationships(writeRequestBuilder.build());
                
                // Store the zedtoken for read-after-write consistency
                String zedtoken = writeResponse.getWrittenAt().getToken();
                if ("document".equals(resourceType)) {
                    Optional<Document> docOpt = documentRepository.findById(UUID.fromString(resourceId));
                    if (docOpt.isPresent()) {
                        Document doc = docOpt.get();
                        doc.setZedtoken(zedtoken);
                        documentRepository.save(doc);
                    }
                } else if ("folder".equals(resourceType)) {
                    Optional<Folder> folderOpt = folderRepository.findById(UUID.fromString(resourceId));
                    if (folderOpt.isPresent()) {
                        Folder folder = folderOpt.get();
                        folder.setZedtoken(zedtoken);
                        folderRepository.save(folder);
                    }
                }
            }

            return ResponseEntity.ok(Map.of("status", "success"));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }
    }
}