import ky from "ky";

const defaultFetch = ky.extend({ timeout: 60_000 });

export const getUploadFileUrl = ({ fields, url }) => `${url}/${fields.key}`;

// Database-only file upload (mock for two-step process)
export const uploadFile = async (
  file,
  { fetch: fetch_ = defaultFetch, fields, FormData: FormData_ = FormData, url }
) => {
  console.log('uploadFile called with:', { fileName: file.name, url, fileSize: file.size });

  // Handle direct upload mode (database-only storage)
  if (url === 'http://localhost:3000/direct-upload') {
    console.log('Direct upload mode: Simulating upload for database storage');
    console.log('File details:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    });
    
    // Validate file size on client side (50MB limit)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error(`File size ${file.size} bytes exceeds maximum of ${MAX_SIZE} bytes (50MB)`);
    }
    
    // For database storage, we don't actually upload the file here
    // The ingest API will fetch and process the file
    return getUploadFileUrl({ fields, url });
  }

  // Fallback for any other URL type (should not happen with database-only setup)
  console.log('Fallback upload mode: Not expected in database-only setup');
  const formData = new FormData_();

  for (const [key, value] of Object.entries({ ...fields, file })) {
    formData.append(key, value);
  }

  await fetch_.post(url, { body: formData });

  return getUploadFileUrl({ fields, url });
};
