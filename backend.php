<?php
// Azure Blob Storage Configuration
// Replace these values with your Azure storage credentials
$storageAccount = 'fileuploader12';
$containerName = 'rashmika';
$ sasToken = 'sp=r&st=2026-04-29T06:18:39Z&se=2026-04-29T14:33:39Z&spr=https&sv=2025-11-05&sr=c&sig=4QPVYcO6wxm1YrvUk4QVr8Fz0sNt3C71UuG%2BOF10%2BiQ%3D'; // Or use $accountKey for shared key auth

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['fileToUpload'])) {
    $file = $_FILES['fileToUpload'];
    
    if ($file['error'] === UPLOAD_ERR_OK) {
        $fileName = basename($file['name']);
        $fileSize = $file['size'];
        $fileType = $file['type'];
        $fileContent = file_get_contents($file['tmp_name']);
        
        // Azure Blob Storage REST API
        $url = "https://{$storageAccount}.blob.core.windows.net/{$containerName}/{$fileName}";
        
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
        curl_setopt($ch, CURLOPT_POSTFIELDS, $fileContent);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'x-ms-blob-type: BlockBlob',
            'x-ms-date: ' . gmdate('D, d M Y H:i:s T'),
            'x-ms-version: 2021-08-06',
            'Content-Type: ' . $fileType,
            'Content-Length: ' . $fileSize,
            'Authorization: SharedKey ' . $storageAccount . ':' . base64_encode(hash_hmac('sha256', "PUT\n\n\n{$fileSize}\n\n{$fileType}\n\n\n\n\n\n\n\nx-ms-blob-type:BlockBlob\nx-ms-date:" . gmdate('D, d M Y H:i:s T') . "\nx-ms-version:2021-08-06\n/{$storageAccount}/{$containerName}/{$fileName}", $accountKey, true))
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode === 201) {
            $status = 'success';
            $message = 'File uploaded successfully to Azure Blob Storage!';
        } else {
            $status = 'error';
            $message = 'Upload failed. HTTP Code: ' . $httpCode . ' - ' . $response;
        }
    } else {
        $status = 'error';
        $message = 'File upload error: ' . $file['error'];
    }
    
    // Redirect back with status
    $redirectUrl = 'index.html?status=' . $status . '&message=' . urlencode($message);
    header('Location: ' . $redirectUrl);
    exit;
}
?>