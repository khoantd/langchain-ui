const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Create system user if it doesn't exist
  const systemUser = await prisma.user.upsert({
    where: { email: 'system@langchain-ui.local' },
    update: {},
    create: {
      id: 'system-user',
      email: 'system@langchain-ui.local',
      name: 'System User',
    },
  });

  console.log('✅ System user created/updated:', systemUser);

  // Create prompt templates
  const templates = [
    {
      name: 'Q&A Assistant',
      prompt: 'You are a helpful Q&A assistant. Answer the following question based on the provided context:\n\nContext: {{context}}\n\nQuestion: {{question}}\n\nProvide a clear and concise answer:',
      inputs: JSON.stringify(['context', 'question'])
    },
    {
      name: 'Content Summarizer',
      prompt: 'Please summarize the following content in a clear and concise manner:\n\n{{content}}\n\nSummary:',
      inputs: JSON.stringify(['content'])
    },
    {
      name: 'Email Writer',
      prompt: 'Write a professional email with the following details:\n\nPurpose: {{purpose}}\nRecipient: {{recipient}}\nKey points: {{key_points}}\nTone: {{tone}}\n\nEmail:',
      inputs: JSON.stringify(['purpose', 'recipient', 'key_points', 'tone'])
    },
    {
      name: 'Code Reviewer',
      prompt: 'Review the following code and provide feedback:\n\nLanguage: {{language}}\nCode:\n{{code}}\n\nPlease analyze for:\n- Code quality and style\n- Potential bugs or issues\n- Performance considerations\n- Best practices adherence\n\nReview:',
      inputs: JSON.stringify(['language', 'code'])
    },
    {
      name: 'Learning Assistant',
      prompt: 'Help me understand {{topic}}. Explain it in {{style}} and provide:\n\n1. A clear definition\n2. Key concepts\n3. Practical examples\n4. Common use cases\n\nTopic to explain: {{detailed_topic}}',
      inputs: JSON.stringify(['topic', 'style', 'detailed_topic'])
    },
    {
      name: 'Creative Story Generator',
      prompt: 'Write a creative story based on the following elements:\n\nGenre: {{genre}}\nMain character: {{main_character}}\nSetting: {{setting}}\nPlot element: {{plot_element}}\nStory length: {{story_length}}\n\nStory:',
      inputs: JSON.stringify(['genre', 'main_character', 'setting', 'plot_element', 'story_length'])
    },
    {
      name: 'Translation Helper',
      prompt: 'Translate the following text from {{source_language}} to {{target_language}}:\n\n{{text_to_translate}}\n\nTranslation:',
      inputs: JSON.stringify(['source_language', 'target_language', 'text_to_translate'])
    },
    {
      name: 'Data Analysis',
      prompt: 'Analyze the following data and provide insights:\n\nData: {{data}}\nAnalysis type: {{analysis_type}}\nFocus area: {{focus_area}}\n\nProvide:\n1. Summary statistics\n2. Key findings\n3. Recommendations\n\nAnalysis:',
      inputs: JSON.stringify(['data', 'analysis_type', 'focus_area'])
    }
  ];

  for (const template of templates) {
    const existing = await prisma.promptTemplate.findFirst({
      where: { 
        name: template.name,
        userId: systemUser.id 
      }
    });

    if (!existing) {
      await prisma.promptTemplate.create({
        data: {
          ...template,
          user: {
            connect: {
              id: systemUser.id
            }
          }
        }
      });
      console.log(`✅ Created prompt template: ${template.name}`);
    } else {
      console.log(`⏭️  Template already exists: ${template.name}`);
    }
  }

  // Create a sample chatbot
  const existingChatbot = await prisma.chatbot.findFirst({
    where: { 
      name: 'Data Analyzer',
      userId: systemUser.id 
    }
  });

  if (!existingChatbot) {
    const qaTemplate = await prisma.promptTemplate.findFirst({
      where: { 
        name: 'Q&A Assistant',
        userId: systemUser.id 
      }
    });

    await prisma.chatbot.create({
      data: {
        name: 'Data Analyzer',
        user: {
          connect: {
            id: systemUser.id
          }
        },
        promptTemplate: qaTemplate ? {
          connect: {
            id: qaTemplate.id
          }
        } : undefined
      }
    });
    console.log('✅ Created sample chatbot: Data Analyzer');
  } else {
    console.log('⏭️  Sample chatbot already exists');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });