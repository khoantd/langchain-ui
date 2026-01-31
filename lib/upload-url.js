import { v4 as uuid } from "uuid";

export const getUploadUrl = async ({ type } = {}) => {
  console.log('getUploadUrl called with:', { type });
  
  // Always use mock mode now - we'll store directly in database
  console.log('Using database-only storage mode');
  
  const mockKey = uuid();
  const mockUrl = {
    url: 'http://localhost:3000/direct-upload',
    fields: {
      key: mockKey,
      'Content-Type': type,
    }
  };
  
  console.log('Generated mock URL:', mockUrl);
  return mockUrl;
};
