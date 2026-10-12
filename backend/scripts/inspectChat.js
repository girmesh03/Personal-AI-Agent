import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import Chat from '../src/models/Chat.js';
import Audio from '../src/models/Audio.js';

async function main() {
  await connectDB();
  while (mongoose.connection.readyState !== 1) {
    await new Promise((r) => setTimeout(r, 500));
  }
  const chatId = '6acd2f7aa9ca400e89e5861c';
  const chat = await Chat.findById(chatId).lean();
  console.log('=== CHAT OVERVIEW ===');
  console.log('ID:', chat?._id);
  console.log('Title:', chat?.title);
  console.log('Total messages:', chat?.messages?.length);

  if (chat && chat.messages) {
    for (let i = 0; i < chat.messages.length; i++) {
      const msg = chat.messages[i];
      console.log(`\n--- MESSAGE [${i}] Role: ${msg.role} ---`);
      console.log('ID:', msg.id || msg._id);
      console.log('Text:', JSON.stringify(msg.text));
      console.log('Audios:', msg.audios);
      console.log('Attachments:', JSON.stringify(msg.attachments));
      console.log('isStopped:', msg.isStopped);
      console.log('Model:', msg.model);
      console.log('CreatedAt:', msg.createdAt);

      if (msg.audios && msg.audios.length > 0) {
        const audioDocs = await Audio.find({ _id: { $in: msg.audios } }).lean();
        console.log('Audio Docs:', JSON.stringify(audioDocs, null, 2));
      }
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
