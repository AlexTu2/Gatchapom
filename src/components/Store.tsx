const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  if (!event.target.files || event.target.files.length === 0) {
    console.error('No files selected');
    return;
  }
  
  const files = Array.from(event.target.files);
  console.log('Files before upload:', files); // Debug log
  try {
    await uploadStickers(files);
  } catch (error) {
    console.error('Upload failed:', error);
  }
}; 