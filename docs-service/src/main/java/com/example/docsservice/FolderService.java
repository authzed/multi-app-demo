package com.example.docsservice;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.util.Optional;

import com.authzed.api.v1.*;
import com.authzed.grpcutil.BearerToken;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;

@Service
public class FolderService {

    @Autowired
    private FolderRepository folderRepository;
    
    private ManagedChannel spiceDBChannel;
    private BearerToken bearerToken;
    
    @PostConstruct
    public void initializeSpiceDB() {
        String endpoint = System.getenv().getOrDefault("SPICEDB_ENDPOINT", "localhost:50051");
        String token = System.getenv().getOrDefault("SPICEDB_TOKEN", "testtesttesttest");
        
        this.spiceDBChannel = ManagedChannelBuilder.forTarget(endpoint)
                .usePlaintext()
                .build();
        this.bearerToken = new BearerToken(token);
        
        initializeRootFolder();
    }
    
    @PreDestroy
    public void shutdownSpiceDB() {
        if (spiceDBChannel != null && !spiceDBChannel.isShutdown()) {
            spiceDBChannel.shutdown();
        }
    }
    
    private PermissionsServiceGrpc.PermissionsServiceBlockingStub getPermissionsClient() {
        return PermissionsServiceGrpc.newBlockingStub(spiceDBChannel)
                .withCallCredentials(bearerToken);
    }

    private void initializeRootFolder() {
        Optional<Folder> existingRoot = folderRepository.findByIsRootTrue();
        Folder rootFolder;
        boolean isNewRoot = false;
        
        if (existingRoot.isEmpty()) {
            rootFolder = new Folder();
            rootFolder.setName("Root");
            rootFolder.setIsRoot(true);
            rootFolder = folderRepository.save(rootFolder);
            isNewRoot = true;
        } else {
            rootFolder = existingRoot.get();
        }
        
        // Create world-readable relationship for root folder
        createWorldRelationship(rootFolder, isNewRoot);
    }
    
    private void createWorldRelationship(Folder rootFolder, boolean isNewRoot) {
        try {
            PermissionsServiceGrpc.PermissionsServiceBlockingStub permClient = getPermissionsClient();
            
            // Check if the world relationship already exists (only if this isn't a new root)
            if (!isNewRoot) {
                ReadRelationshipsRequest readRequest = ReadRelationshipsRequest.newBuilder()
                        .setRelationshipFilter(RelationshipFilter.newBuilder()
                                .setResourceType("folder")
                                .setOptionalResourceId(rootFolder.getId().toString())
                                .setOptionalRelation("editor")
                                .setOptionalSubjectFilter(SubjectFilter.newBuilder()
                                        .setSubjectType("user")
                                        .build())
                                .build())
                        .build();

                boolean worldRelationshipExists = permClient.readRelationships(readRequest).hasNext();
                if (worldRelationshipExists) {
                    return; // Relationship already exists
                }
            }
            
            // Create the world relationship: folder:<uuid>#editor@user:*
            WriteRelationshipsRequest writeRequest = WriteRelationshipsRequest.newBuilder()
                    .addUpdates(RelationshipUpdate.newBuilder()
                            .setOperation(RelationshipUpdate.Operation.OPERATION_CREATE)
                            .setRelationship(Relationship.newBuilder()
                                    .setResource(ObjectReference.newBuilder()
                                            .setObjectType("folder")
                                            .setObjectId(rootFolder.getId().toString())
                                            .build())
                                    .setRelation("editor")
                                    .setSubject(SubjectReference.newBuilder()
                                            .setObject(ObjectReference.newBuilder()
                                                    .setObjectType("user")
                                                    .setObjectId("*")
                                                    .build())
                                            .build())
                                    .build())
                            .build())
                    .build();

            WriteRelationshipsResponse writeResponse = permClient.writeRelationships(writeRequest);
            
            // Store the zedtoken for read-after-write consistency
            String zedtoken = writeResponse.getWrittenAt().getToken();
            rootFolder.setZedtoken(zedtoken);
            folderRepository.save(rootFolder);
            
            System.out.println("Created world editor relationship for root folder: " + rootFolder.getId());
            
        } catch (Exception e) {
            System.err.println("Failed to create world relationship for root folder: " + e.getMessage());
            e.printStackTrace();
        }
    }

    public Folder getRootFolder() {
        return folderRepository.findByIsRootTrue()
                .orElseThrow(() -> new RuntimeException("Root folder not found"));
    }
}