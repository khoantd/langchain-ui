import { authenticateRequest } from "@/pages/api/auth-helper";
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const user = await authenticateRequest(req, res);
  if (!user) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { litellmApiKey, litellmUrl } = req.body;
    
    // Validate API key format
    if (litellmApiKey && !litellmApiKey.startsWith('sk-')) {
      return res.status(400).json({ error: 'Invalid API key format' });
    }

    // Update the .env file (in production, you'd want to use a more secure method)
    const envPath = path.join(process.cwd(), '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Update API key
    if (litellmApiKey) {
      const newApiKeyLine = `LITELLM_API_KEY="${litellmApiKey}"`;
      if (envContent.includes('LITELLM_API_KEY=')) {
        envContent = envContent.replace(/LITELLM_API_KEY=.*/, newApiKeyLine);
      } else {
        envContent += '\n' + newApiKeyLine;
      }
      // Update the environment variable for current process
      process.env.LITELLM_API_KEY = litellmApiKey;
    }
    
    // Update URL
    if (litellmUrl) {
      const newUrlLine = `LITELLM_URL="${litellmUrl}"`;
      if (envContent.includes('LITELLM_URL=')) {
        envContent = envContent.replace(/LITELLM_URL=.*/, newUrlLine);
      } else {
        envContent += '\n' + newUrlLine;
      }
      // Update the environment variable for current process
      process.env.LITELLM_URL = litellmUrl;
    }
    
    fs.writeFileSync(envPath, envContent);
    
    return res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('Error saving LiteLLM configuration:', error);
    return res.status(500).json({ error: 'Failed to save configuration' });
  }
}