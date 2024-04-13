import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { MessagesPlaceholder } from "@langchain/core/prompts";
import readline from "readline";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

import transcriptYoutubeVideo from "./transcriptYoutubeVideo.mjs";

const OPENAI_API_KEY = "";

const chatModel = new ChatOpenAI({
  openAIApiKey: OPENAI_API_KEY,
});

const embeddings = new OpenAIEmbeddings({
  openAIApiKey: OPENAI_API_KEY,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const start = async () => {
  rl.question("Youtube URL: ", async (youtubeURL) => {
    console.log("Fazendo transcricão do video... ");
    const videoTranscribed = await transcriptYoutubeVideo(youtubeURL);

    if (!videoTranscribed) {
      return;
    }

    const historyAwarePrompt = ChatPromptTemplate.fromMessages([
      new MessagesPlaceholder("chat_history"),
      ["user", "{input}"],
      [
        "user",
        "Given the above conversation, generate a search query to look up in order to get information relevant to the conversation",
      ],
    ]);

    const splitter = new RecursiveCharacterTextSplitter();

    const splitDocs = await splitter.splitDocuments([
      new Document({ pageContent: videoTranscribed }),
    ]);

    const vectorstore = await MemoryVectorStore.fromDocuments(
      splitDocs,
      embeddings
    );

    const retriever = vectorstore.asRetriever();

    const historyAwareRetrieverChain = await createHistoryAwareRetriever({
      llm: chatModel,
      retriever,
      rephrasePrompt: historyAwarePrompt,
    });

    const historyAwareRetrievalPrompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        "the context is a transcription of a youtube video that will be used to answer questions about the content and learn other related things, answer the questions based on the context and your previous knowledge about other related topics if the video is not enough to answer:\n\n{context}",
      ],
      new MessagesPlaceholder("chat_history"),
      ["user", "{input}"],
    ]);

    const historyAwareCombineDocsChain = await createStuffDocumentsChain({
      llm: chatModel,
      prompt: historyAwareRetrievalPrompt,
    });

    const conversationalRetrievalChain = await createRetrievalChain({
      retriever: historyAwareRetrieverChain,
      combineDocsChain: historyAwareCombineDocsChain,
    });

    const chat_history = [];

    function askQuestion() {
      rl.question("\nPergunta: ", async (question) => {
        if (question === "0") {
          rl.close();
          return;
        }

        const result = await conversationalRetrievalChain.invoke({
          chat_history: chat_history,
          input: question,
        });

        chat_history.push(new HumanMessage(question));
        chat_history.push(new AIMessage(result.answer));

        console.log("Resposta: ",result.answer);

        askQuestion();
      });
    }

    askQuestion();
  });
};

start();
