import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.development' });

async function testOpenAIModels() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not found in environment variables');
    process.exit(1);
  }

  console.log('🔑 Testing OpenAI API Key...');
  console.log(`Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
  
  try {
    // Test 1: Check available models
    console.log('\n📋 Checking available models...');
    const modelsResponse = await axios.get('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    // Filter for chat completion models
    const chatModels = modelsResponse.data.data
      .filter((model: any) => 
        model.id.includes('gpt') && 
        !model.id.includes('instruct') &&
        !model.id.includes('edit') &&
        !model.id.includes('embedding') &&
        !model.id.includes('whisper') &&
        !model.id.includes('tts') &&
        !model.id.includes('dall-e')
      )
      .map((model: any) => model.id)
      .sort();

    console.log('✅ Available Chat Models:');
    chatModels.forEach((model: string, index: number) => {
      const tier = getModelTier(model);
      console.log(`   ${index + 1}. ${model} ${tier}`);
    });

    // Test 2: Test the most advanced available model
    console.log('\n🧪 Testing model functionality...');
    const testModel = getBestAvailableModel(chatModels);
    console.log(`Using model: ${testModel}`);

    const testResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: testModel,
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Respond with exactly: "API test successful"' }
      ],
      max_tokens: 10,
      temperature: 0
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ Test Response: ${testResponse.data.choices[0].message.content}`);
    console.log(`💰 Tokens Used: ${testResponse.data.usage.total_tokens}`);

    // Test 3: Determine API tier
    console.log('\n🎯 API Access Analysis:');
    const apiTier = determineAPITier(chatModels);
    console.log(`API Tier: ${apiTier.name}`);
    console.log(`Access Level: ${apiTier.description}`);
    console.log(`Recommended Model: ${apiTier.recommendedModel}`);

    // Test 4: Model-specific tests
    console.log('\n🔍 Model-specific tests:');
    await testSpecificModels(chatModels, apiKey);

  } catch (error: any) {
    console.error('\n❌ Error testing OpenAI API:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Message: ${error.response.data?.error?.message || 'Unknown error'}`);
      
      if (error.response.status === 401) {
        console.error('🔐 Invalid API Key - Check your OPENAI_API_KEY');
      } else if (error.response.status === 403) {
        console.error('🚫 Access denied - Your API key may not have the required permissions');
      } else if (error.response.status === 429) {
        console.error('⏱️  Rate limit exceeded - Try again later');
      }
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

function getModelTier(model: string): string {
  if (model.includes('gpt-4')) {
    if (model.includes('turbo')) return '🚀 (GPT-4 Turbo)';
    return '⭐ (GPT-4)';
  } else if (model.includes('gpt-3.5')) {
    if (model.includes('turbo')) return '💫 (GPT-3.5 Turbo)';
    return '✨ (GPT-3.5)';
  }
  return '📝 (Other)';
}

function getBestAvailableModel(models: string[]): string {
  const preferenceOrder = [
    'gpt-4-turbo-preview',
    'gpt-4-turbo',
    'gpt-4-1106-preview',
    'gpt-4',
    'gpt-3.5-turbo-1106',
    'gpt-3.5-turbo'
  ];

  for (const preferred of preferenceOrder) {
    if (models.includes(preferred)) {
      return preferred;
    }
  }

  return models.find(m => m.includes('gpt')) || models[0];
}

function determineAPITier(models: string[]): any {
  const hasGPT4 = models.some(m => m.includes('gpt-4'));
  const hasGPT4Turbo = models.some(m => m.includes('gpt-4-turbo'));
  const hasGPT35 = models.some(m => m.includes('gpt-3.5'));

  if (hasGPT4Turbo) {
    return {
      name: 'Premium',
      description: 'Full access to latest models',
      recommendedModel: getBestAvailableModel(models)
    };
  } else if (hasGPT4) {
    return {
      name: 'Advanced',
      description: 'Access to GPT-4 models',
      recommendedModel: getBestAvailableModel(models)
    };
  } else if (hasGPT35) {
    return {
      name: 'Standard',
      description: 'Access to GPT-3.5 models',
      recommendedModel: getBestAvailableModel(models)
    };
  } else {
    return {
      name: 'Limited',
      description: 'Limited model access',
      recommendedModel: models[0] || 'none'
    };
  }
}

async function testSpecificModels(models: string[], apiKey: string) {
  const testModels = ['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo'];
  
  for (const model of testModels) {
    if (models.includes(model)) {
      try {
        const start = Date.now();
        await axios.post('https://api.openai.com/v1/chat/completions', {
          model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5
        }, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        const time = Date.now() - start;
        console.log(`   ✅ ${model}: ${time}ms`);
      } catch (error: any) {
        console.log(`   ❌ ${model}: ${error.response?.data?.error?.message || 'Failed'}`);
      }
    } else {
      console.log(`   ⏭️  ${model}: Not available`);
    }
  }
}

// Run the test
testOpenAIModels();