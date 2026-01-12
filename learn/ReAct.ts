import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

import os from 'os'
import fs from 'fs'
import dotenv from 'dotenv'
import readlineSync from 'readline-sync';
dotenv.config({
  override: true
})

const operating_system = os.platform()
const file_list = fs.readdirSync('.')

const tools = [
  {
    name: 'mkdir',
    description: '创建一个目录',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: '目录路径',
      },
    ],
    function: (path: string) => {
      fs.mkdirSync(path)
    },
  },
  {
    name: 'write_to_file',
    description: '写入一个文件',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: '文件路径',
      },
      {
        name: 'content',
        type: 'string',
        description: '文件内容',
      },
    ],
    function: (path: string, content: string) => {
      fs.writeFileSync(path, content)
    },
  },
  {
    name: 'append_to_file',
    description: '追加内容到文件',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: '文件路径',
      },
      {
        name: 'content',
        type: 'string',
        description: '文件内容',
      },
    ],
    function: (path: string, content: string) => {
      fs.appendFileSync(path, content)
    },
  },
  {
    name: 'read_file',
    description: '读取一个文件',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: '文件路径',
      },
    ],
    function: (path: string) => {
      return fs.readFileSync(path, 'utf-8')
    },
  },
  {
    name: 'delete_file',
    description: '删除一个文件',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: '文件路径',
      },
    ],
    function: (path: string) => {
      fs.unlinkSync(path)
    },
  },
  {
    name: 'create_file',
    description: '创建一个文件',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: '文件路径',
      },
      {
        name: 'content',
        type: 'string',
        description: '文件内容',
      },
    ],
    function: (path: string, content: string) => {
      fs.writeFileSync(path, content)
    },
  },
  {
    name: 'rename_file',
    description: '重命名一个文件',
    parameters: [
      {
        name: 'old_path',
        type: 'string',
        description: '旧文件路径',
      },
      {
        name: 'new_path',
        type: 'string',
        description: '新文件路径',
      },
    ],
    function: (old_path: string, new_path: string) => {
      fs.renameSync(old_path, new_path)
    },
  },
]

const tool_list = `
${tools.map(tool => `- ${tool.name}(${tool.parameters.map(param => `${param.name}: ${param.type}`).join(', ')})`).join('\n')}
`

const prompt = `
你需要解决一个问题。这是一个**循环执行**的过程：

1. 先用 <thought> 思考要做什么
2. 然后使用 <action> 调用一个工具
3. **等待**我返回工具的 <observation> 结果
4. 根据 observation 决定下一步：如果还需要更多信息，继续思考并调用工具；如果已经足够，给出 <final_answer>
5. **重复步骤1-4**，直到可以给出最终答案

**重要规则**：
- 你**每次只能输出一次** <action>，然后必须停止，等待 observation
- **绝对不要**在输出 <action> 后自己生成 <observation>，这会导致错误
- **绝对不要**在还没有执行任何工具的情况下就给出 <final_answer>
- 必须通过执行工具获得足够信息后，才能给出 <final_answer>

所有步骤请严格使用以下 XML 标签格式输出：
- <thought> 思考
- <action> 采取的工具操作（格式：工具名(参数1="值1", 参数2="值2")）
- <observation> 工具或环境返回的结果（**只能由我来提供，你不要生成**）
- <final_answer> 最终答案

⸻

例子 1:

<question>埃菲尔铁塔有多高？</question>
<thought>我需要找到埃菲尔铁塔的高度。可以使用搜索工具。</thought>
<action>get_height("埃菲尔铁塔")</action>
（等待 observation...）
<observation>埃菲尔铁塔的高度约为330米（包含天线）。</observation>
<thought>搜索结果显示了高度。我已经得到答案了。</thought>
<final_answer>埃菲尔铁塔的高度约为330米。</final_answer>

⸻

例子 2:

<question>帮我找一个简单的番茄炒蛋食谱，并看看家里的冰箱里有没有西红柿。</question>
<thought>这个任务分两步。第一步，找到番茄炒蛋的食谱。第二步，检查冰箱里是否有西红柿。我先用 find_recipe 工具找食谱。</thought>
<action>find_recipe(dish="番茄炒蛋")</action>
（等待 observation...）
<observation>简单的番茄炒蛋食谱：将2个鸡蛋打散，2个番茄切块。热油，先炒鸡蛋，盛出。再热油，炒番茄至软烂，加入鸡蛋，放盐调味即可。</observation>
<thought>好的，我已经有食谱了。食谱需要西红柿。现在我需要用 check_fridge 工具看看冰箱里有没有西红柿。</thought>
<action>check_fridge(item="西红柿")</action>
（等待 observation...）
<observation>冰箱检查结果：有3个西红柿。</observation>
<thought>我找到了食谱，并且确认了冰箱里有西红柿。可以回答问题了。</thought>
<final_answer>简单的番茄炒蛋食谱是：鸡蛋打散，番茄切块。先炒鸡蛋，再炒番茄，混合后加盐调味。冰箱里有3个西红柿。</final_answer>

⸻

本次任务可用工具：
${tool_list}

⸻

环境信息：

操作系统：${operating_system}
当前目录下文件列表：${file_list}
`

const client = new OpenAI({
  apiKey: process.env.OPEN_ROUTER_API_KEY, // This is the default and can be omitted
  baseURL: process.env.OPEN_ROUTER_BASE_URL,
});


/**
 * 处理转义字符
 */
const unescapeString = (str: string): string => {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\\\/g, '\\')
    .replace(/\\"/g, '"');
};

/**
 * 解析工具调用的参数
 * 支持格式：tool_name("param1", "param2") 或 tool_name(param1="value1", param2="value2")
 */
const parseAction = (actionStr: string): { toolName: string; params: any[] } | null => {
  const match = actionStr.match(/^(\w+)\((.*)\)$/);
  if (!match) return null;

  const toolName = match[1];
  const paramsStr = match[2].trim();

  // 如果参数为空
  if (!paramsStr) {
    return { toolName, params: [] };
  }

  const params: any[] = [];

  // 尝试解析命名参数格式：param1="value1", param2="value2"
  // 使用更复杂的正则来匹配可能包含转义字符的字符串
  const namedParamRegex = /(\w+)="((?:[^"\\]|\\.)*)"/g;
  let namedMatch;
  let lastIndex = 0;

  while ((namedMatch = namedParamRegex.exec(paramsStr)) !== null) {
    // 处理转义字符
    const value = unescapeString(namedMatch[2]);
    params.push(value);
    lastIndex = namedParamRegex.lastIndex;
  }

  // 如果解析了命名参数，返回结果
  if (lastIndex > 0) {
    return { toolName, params };
  }

  // 否则尝试解析位置参数格式："param1", "param2"
  // 使用更复杂的正则来匹配可能包含转义字符的字符串
  const positionalParamRegex = /"((?:[^"\\]|\\.)*)"/g;
  const positionalMatches: string[] = [];
  let posMatch;

  while ((posMatch = positionalParamRegex.exec(paramsStr)) !== null) {
    positionalMatches.push(posMatch[1]);
  }

  if (positionalMatches.length > 0) {
    params.push(...positionalMatches.map(unescapeString));
    return { toolName, params };
  }

  // 如果都没有匹配，尝试作为单个未引号的参数
  return { toolName, params: [paramsStr] };
};

const main = async () => {
  const messages = [
    { role: "system", content: prompt, }
  ] as ChatCompletionMessageParam[];

  // const question = readlineSync.question('请输入问题: ')
  messages.push({
    role: "user",
    content: `<question>帮我创建一个贪食蛇的游戏，并保存到 当前目录下snake 文件夹下，文件名称为 snake.html，拆分css和js文件，并引入到html文件中</question>`,
  })

  let maxIterations = 20; // 防止无限循环
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;

    const completion = await client.chat.completions.create({
      model: process.env.OPEN_ROUTER_XIAOMI_MODEL as string,
      messages: messages,
      // 添加 stop sequences，让模型在输出 </action> 后停止
      stop: ['</action>', '\n<observation>', '\n<final_answer>'],
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      console.log('模型没有返回内容');
      break;
    }

    console.log('\n=== 模型输出 ===');
    console.log(content);
    console.log('===============\n');

    // 将助手的回复添加到消息历史
    messages.push({ role: "assistant", content: content });

    // 检查是否有 action
    if (content.includes('<action>')) {
      const actionMatch = content.match(/<action>(.*?)<\/action>/s);
      if (actionMatch) {
        const actionStr = actionMatch[1].trim();
        console.log(`执行工具调用: ${actionStr}`);

        const parsed = parseAction(actionStr);
        if (!parsed) {
          console.error(`无法解析 action: ${actionStr}`);
          messages.push({
            role: "user",
            content: `<observation>错误：无法解析工具调用格式。请使用格式：工具名(参数1="值1", 参数2="值2")</observation>`
          });
          continue;
        }

        const { toolName, params } = parsed;
        const tool = tools.find(t => t.name === toolName);

        if (!tool) {
          console.error(`未找到工具: ${toolName}`);
          messages.push({
            role: "user",
            content: `<observation>错误：未找到工具 "${toolName}"。可用工具：${tools.map(t => t.name).join(', ')}</observation>`
          });
          continue;
        }

        // 执行工具
        try {
          console.log(`调用工具: ${toolName}, 参数:`, params);
          // 使用 Function.apply 来安全地调用工具函数
          const result = (tool.function as (...args: any[]) => any).apply(null, params);
          const observation = result !== undefined ? String(result) : '工具执行成功';
          console.log(`工具执行结果: ${observation}`);

          // 将 observation 添加到消息历史
          messages.push({
            role: "user",
            content: `<observation>${observation}</observation>`
          });
        } catch (error: any) {
          console.error(`工具执行错误:`, error);
          messages.push({
            role: "user",
            content: `<observation>错误：${error.message || String(error)}</observation>`
          });
        }
        continue; // 继续循环，等待模型的下一个响应
      }
    }

    // 检查是否有 final_answer
    if (content.includes('<final_answer>')) {
      const finalAnswerMatch = content.match(/<final_answer>(.*?)<\/final_answer>/s);
      if (finalAnswerMatch) {
        console.log('\n=== 最终答案 ===');
        console.log(finalAnswerMatch[1].trim());
        console.log('================\n');
      }
      break;
    }

    // 如果既没有 action 也没有 final_answer，可能是格式问题
    console.warn('警告：模型返回的内容中既没有 <action> 也没有 <final_answer>');
    messages.push({
      role: "user",
      content: `<observation>请按照格式输出，必须包含 <thought> 和 <action>（如果还需要执行工具）或 <final_answer>（如果已经可以回答问题）。</observation>`
    });
  }

  if (iteration >= maxIterations) {
    console.error('达到最大迭代次数，停止执行');
  }
}
//  帮我创建一个贪食蛇的游戏，并保存到 当前目录下snake 文件夹下，文件名称为 snake.html，拆分css和js文件，并引入到html文件中
main()