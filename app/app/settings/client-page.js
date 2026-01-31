"use client";
import React, { useState } from "react";
import {
  Box,
  Center,
  Container,
  Stack,
  Text,
  useColorModeValue,
  Heading,
  Divider,
  Switch,
  FormControl,
  FormLabel,
  HStack,
  Icon,
  Input,
  Button,
  Alert,
  AlertIcon,
  FormHelperText,
} from "@chakra-ui/react";
import { useSidebar } from "@/lib/sidebar";
import PageHeader from "@/components/page-header";

export default function SettingsClientPage() {
  const buttonColorScheme = useColorModeValue("blackAlpha", "whiteAlpha");
  const buttonBackgroundColor = useColorModeValue("black", "white");
  const menu = useSidebar();
  
  const [litellmApiKey, setLitellmApiKey] = useState("");
  const [litellmUrl, setLitellmUrl] = useState("https://litellm.ai/api/v1");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [testMessage, setTestMessage] = useState("");

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveMessage("");
    
    try {
      const response = await fetch('/api/settings/litellm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          litellmApiKey,
          litellmUrl 
        }),
      });
      
      if (response.ok) {
        setSaveMessage("LiteLLM configuration saved successfully!");
      } else {
        setSaveMessage("Failed to save configuration");
      }
    } catch (error) {
      setSaveMessage("Error saving configuration");
    }
    
    setIsSaving(false);
    setTimeout(() => setSaveMessage(""), 3000);
  };

  const handleTestConnection = async () => {
    if (!litellmApiKey) {
      setTestMessage("❌ Please enter an API key first");
      return;
    }

    if (!litellmUrl.startsWith('http://') && !litellmUrl.startsWith('https://')) {
      setTestMessage("❌ URL must start with http:// or https://");
      return;
    }

    setIsTesting(true);
    setTestMessage("");
    
    try {
      const testUrl = litellmUrl.endsWith('/') ? litellmUrl + 'chat/completions' : `${litellmUrl}/chat/completions`;
      
      console.log('Testing URL:', testUrl);
      
      const testPayload = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'Hello, this is a test message.' }
        ],
        max_tokens: 10,
      };

      console.log('Test payload:', testPayload);
      
      const response = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${litellmApiKey}`,
          'User-Agent': 'LangChain-UI-Test/1.0',
        },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      console.log('Test response status:', response.status);
      console.log('Test response headers:', Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const data = await response.json();
        console.log('Test response data:', data);
        setTestMessage("✅ Connection successful! Your LiteLLM proxy is working correctly.");
      } else {
        const error = await response.text();
        console.log('Test error response:', error);
        
        let friendlyMessage = `❌ Connection failed (${response.status})`;
        if (response.status === 401) {
          friendlyMessage += " - Invalid API key";
        } else if (response.status === 404) {
          friendlyMessage += " - Endpoint not found. Check proxy URL.";
        } else if (response.status === 429) {
          friendlyMessage += " - Rate limit exceeded";
        } else if (response.status >= 500) {
          friendlyMessage += " - Proxy server error";
        }
        
        setTestMessage(friendlyMessage);
      }
    } catch (error) {
      console.error('Test connection error:', error);
      let errorMessage = `❌ Network error`;
      if (error.name === 'AbortError') {
        errorMessage += " - Request timed out (10s)";
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage += " - Connection refused";
      } else if (error.code === 'ENOTFOUND') {
        errorMessage += " - Host not found";
      }
      setTestMessage(errorMessage);
    }
    
    setIsTesting(false);
    setTimeout(() => setTestMessage(""), 8000);
  };

  return (
    <Stack flex={1} padding={4} spacing={4}>
      <PageHeader
        icon={menu.find(({ id }) => id === "settings").icon}
        title="Settings"
      />
      
      <Center flex={1}>
        <Container maxW="container.md">
          <Stack spacing={6}>
            <Stack spacing={1}>
              <Icon
                fontSize="2xl"
                as={menu.find(({ id }) => id === "settings").icon}
              />
              <Heading size="lg">Settings</Heading>
              <Text fontSize="sm" color="gray.500">
                Manage your application preferences and account settings.
              </Text>
            </Stack>
            
            <Divider />
            
            <Stack spacing={4}>
              <Heading size="md">Preferences</Heading>
              
              <FormControl display="flex" alignItems="center">
                <FormLabel htmlFor="email-alerts" mb="0">
                  Email notifications
                </FormLabel>
                <Switch id="email-alerts" />
              </FormControl>
              
              <FormControl display="flex" alignItems="center">
                <FormLabel htmlFor="data-sharing" mb="0">
                  Share usage data
                </FormLabel>
                <Switch id="data-sharing" />
              </FormControl>
            </Stack>
            
            <Divider />
            
            <Stack spacing={4}>
              <Heading size="md">Account</Heading>
              <Text fontSize="sm" color="gray.500">
                Account management settings will be available here.
              </Text>
            </Stack>
            
            <Divider />
            
            <Stack spacing={4}>
              <Heading size="md">LiteLLM Configuration</Heading>
              
              <FormControl>
                <FormLabel>LiteLLM API Key</FormLabel>
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={litellmApiKey}
                  onChange={(e) => setLitellmApiKey(e.target.value)}
                  mb={2}
                />
                <FormHelperText>
                  Get your API key from LiteLLM dashboard. Configure your AI models through LiteLLM.
                </FormHelperText>
              </FormControl>
              
              <FormControl>
                <FormLabel>LiteLLM URL</FormLabel>
                <Input
                  placeholder="https://litellm.ai/api/v1"
                  value={litellmUrl}
                  onChange={(e) => {
                    const url = e.target.value;
                    // Basic URL validation
                    if (url === '' || url.startsWith('http://') || url.startsWith('https://')) {
                      setLitellmUrl(url);
                    }
                  }}
                  mb={2}
                  isInvalid={litellmUrl !== '' && !(litellmUrl.startsWith('http://') || litellmUrl.startsWith('https://'))}
                />
                <FormHelperText>
                  Custom LiteLLM endpoint URL. Use your proxy server or self-hosted instance.
                  <br />
                  <br />
                  <strong>Proxy Examples:</strong>
                  <br />
                  • Official: https://litellm.ai/api/v1
                  <br />
                  • Your Proxy: https://litellm.khoadue.me/api/v1
                  <br />
                  • Self-hosted: http://localhost:4000/api/v1
                  <br />
                  • Custom: https://your-proxy-domain.com/api/v1
                  <br />
                  <br />
                  <Text color="gray.600">
                    Ensure your proxy accepts POST requests to /chat/completions with Bearer token auth
                  </Text>
                  <br />
                  <Text color={litellmUrl !== '' && !(litellmUrl.startsWith('http://') || litellmUrl.startsWith('https://')) ? "red.500" : "inherit"}>
                    URL must start with http:// or https://
                  </Text>
                </FormHelperText>
              </FormControl>
              
              <HStack spacing={3}>
                <Button
                  colorScheme={buttonColorScheme}
                  backgroundColor={buttonBackgroundColor}
                  size="sm"
                  onClick={handleSaveConfig}
                  isLoading={isSaving}
                  loadingText="Saving..."
                >
                  Save Configuration
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  isLoading={isTesting}
                  loadingText="Testing..."
                >
                  Test Connection
                </Button>
              </HStack>
            </Stack>
              
              {saveMessage && (
                <Alert status={saveMessage.includes("success") ? "success" : "error"}>
                  <AlertIcon />
                  {saveMessage}
                </Alert>
              )}
              
              {testMessage && (
                <Alert status={testMessage.includes("✅") ? "success" : "error"}>
                  <AlertIcon />
                  {testMessage}
                </Alert>
              )}
          </Stack>
        </Container>
      </Center>
    </Stack>
  );
}