import React, { useCallback, useState } from "react";
import PropTypes from "prop-types";
import { Stack } from "@chakra-ui/react";

import { createChatbotMessage } from "@/lib/api";
import ChatInput from "./input";
import ChatOuput from "./output";

// Use relative URLs since we're on the same domain

export default function Chat({ id, ...properties }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState();
  const [isSendingMessage, setIsSendingMessage] = useState();
  const decoder = new TextDecoder();

  const onSubmit = useCallback(
    async (values) => {
      setIsSendingMessage(true);
      setMessages((previousMessages) => [
        ...previousMessages,
        { agent: "user", data: { response: values } },
      ]);

      try {
        // Call our LiteLLM completion endpoint
        const response = await fetch(`/api/chat/${id}/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: values,
            chatbotId: id,
          }),
        });

        const data = await response.json();

        if (data.success) {
          setMessages((previousMessages) => [
            ...previousMessages,
            { agent: "ai", data: { response: data.response } },
          ]);
        } else {
          setMessages((previousMessages) => [
            ...previousMessages,
            { agent: "ai", data: { response: `Error: ${data.error}` } },
          ]);
        }
      } catch (error) {
        console.error('Chat completion error:', error);
        setMessages((previousMessages) => [
          ...previousMessages,
          { agent: "ai", data: { response: "Sorry, I encountered an error. Please try again." } },
        ]);
      }

      setIsSendingMessage();
      setNewMessage();
    },
    [id]
  );

  return (
    <Stack
      {...properties}
      minHeight="100vh"
      maxHeight="100vh"
      spacing={6}
      position="relative"
    >
      <ChatOuput
        isLoading={isSendingMessage}
        messages={messages}
        newMessage={newMessage}
        overflowY="auto"
        paddingBottom={40}
      />
      <ChatInput
        position="absolute"
        bottom="0"
        width="100%"
        isLoading={isSendingMessage}
        onSubmit={onSubmit}
        paddingY={6}
      />
    </Stack>
  );
}
