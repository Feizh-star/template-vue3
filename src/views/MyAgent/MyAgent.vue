<script setup lang="ts">
import { vAutoTextarea } from '@/directives/v-auto-textarea'
import MessageList from './components/MessageList/MessageList.vue'
import MessageItem from './components/MessageItem/MessageItem.vue'
import MarkdownRenderer from './components/MarkdownRenderer/MarkdownRenderer.vue'
import { loadGithubMarkdownTheme } from '@/compositions/useGithubMarkdownTheme'
import { markdownLoader } from './components/MarkdownRenderer/loader/markdown-loader'
import { useChat } from './compositions/useChat'
import { useChatList } from './compositions/useChatList'
import { useOnline } from './compositions/useOnline'

const { chatList, getChatList } = useChatList()
const { onlineIconUrl, toggleOnlineSearch } = useOnline()

const {
  inputText,
  sendIconUrl,
  messageItems,
  messageListRef,
  loadingHistory,
  sendMessage,
  sendMessageWithEnter,
  sessionClicked,
  loadHistoryMessages,
  clearChatStatus,
  createNewChat,
} = useChat({ getChatList })

onBeforeMount(() => {
  getChatList()
  inputText.value = ''
  markdownLoader()
  loadGithubMarkdownTheme(false)
})
onBeforeUnmount(() => {
  clearChatStatus()
})
</script>

<template>
  <div class="my-agent">
    <div class="chart-records">
      <div class="ctrl-btns">
        <el-button class="new-chat-btn" type="primary" color="#626aef" plain @click="createNewChat"
          >新对话</el-button
        >
      </div>
      <ul class="chat-session-list">
        <li
          class="chat-session-item"
          v-for="item in chatList"
          :key="item.id"
          @click="sessionClicked(item)"
        >
          <img src="./assets/history1.svg" alt="" />
          <div class="chat-session-title">
            <div class="chat-session-text">{{ item.title?.trim() || '未命名' }}</div>
          </div>
        </li>
      </ul>
    </div>
    <div class="chat-panel">
      <div class="chat-box">
        <div class="chat-list">
          <MessageList
            ref="messageListRef"
            :isLoadingHistory="loadingHistory"
            @reach-top="() => loadHistoryMessages(true)"
          >
            <MessageItem
              v-for="item in messageItems"
              :key="item.id"
              :role="item.role"
              :hint="item.hint"
              :hintType="item.hintType"
              :content="item.content || ''"
              :data-anchor-id="item.id"
            >
              <MarkdownRenderer :content="item.content || ''" />
            </MessageItem>
          </MessageList>
        </div>
        <div class="chat-textarea">
          <div class="input-part">
            <el-scrollbar>
              <textarea
                id="chat-textarea"
                class="user-input"
                v-auto-textarea="{ minRows: 1 }"
                rows="1"
                v-model="inputText"
                @keydown.exact.enter.prevent="sendMessageWithEnter"
                placeholder="请描述您的问题"
              ></textarea>
            </el-scrollbar>
          </div>
          <div class="ctrl-part">
            <div class="left-ctrl">
              <div class="icon-item" @click="toggleOnlineSearch">
                <img :src="onlineIconUrl" alt="" />
              </div>
            </div>
            <div class="right-ctrl">
              <div class="icon-item">
                <img :src="sendIconUrl" alt="" @click="sendMessage" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.my-agent {
  width: 100%;
  height: 100%;
  display: flex;
  gap: 12px;
  .chart-records {
    width: 240px;
    height: 100%;
    padding: 12px 0;
    background-color: #ffffff;
    border-radius: 8px;
    box-shadow: 0 3px 26px 0px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    .ctrl-btns {
      padding: 0px 8px;
      .new-chat-btn {
        width: 100%;
      }
    }

    .chat-session-list {
      flex: 1;
      min-height: 0;
      padding: 12px 8px;
      .chat-session-item {
        padding: 8px 12px;
        cursor: pointer;
        font-family: 'AlibabaPuHuiTi_2_55';
        font-size: 14px;
        display: flex;
        align-items: center;
        color: #7f7f7f;
        &:hover {
          background-color: #f5f7fa;
        }
        > img {
          height: 16px;
          margin-right: 4px;
        }
        .chat-session-title {
          flex: 1;
          min-width: 0;
          .chat-session-text {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
      }
    }
  }
  .chat-panel {
    flex: 1;
    min-width: 0;
    display: flex;
    justify-content: center;
    background-color: #ffffff;
    border-radius: 8px;
    box-shadow: 0 3px 26px 0px rgba(0, 0, 0, 0.15);
    .chat-box {
      width: 80%;
      height: 100%;
      max-width: 960px;
      padding: 12px 0;
      display: flex;
      flex-direction: column;
      .chat-list {
        flex: 1;
        min-height: 0;
      }
      .chat-textarea {
        border-radius: 20px;
        border: 1px solid #2e68fb;
        background: #fbfcfd;
        box-shadow: 0 43px 12px 0 rgba(189, 189, 189, 0), 0 27px 11px 0 rgba(189, 189, 189, 0.01),
          0 15px 9px 0 rgba(189, 189, 189, 0.05), 0 7px 7px 0 rgba(189, 189, 189, 0.09),
          0 2px 4px 0 rgba(189, 189, 189, 0.1);

        .input-part {
          :deep(.el-scrollbar) {
            max-height: 144px;
            border-top-left-radius: 20px;
            border-top-right-radius: 20px;
            .el-scrollbar__wrap {
              height: 100%;
            }
            .el-scrollbar__view {
              max-height: 120px;
              height: 100%;
            }
          }
          .user-input {
            border: none;
            outline: none;
            padding: 12px;
            width: 100%;
            color: #313131;
            font-family: 'AlibabaPuHuiTi_2_55';
            font-size: 16px;
            line-height: 24px;
            overflow: hidden;
            resize: none;
            background-color: transparent;
            &::placeholder {
              color: #cccccc;
            }
          }
        }
        .ctrl-part {
          height: 56px;
          display: flex;
          justify-content: space-between;
          .left-ctrl {
            display: inline-flex;
            align-items: center;
            padding-left: 20px;
            .icon-item {
              width: 32px;
              height: 32px;
              border-radius: 50%;
              background-color: #fff;
              box-shadow: 0 3.373px 26.981px -3.373px rgba(99, 140, 243, 0.32);
              display: flex;
              justify-content: center;
              align-items: center;
              cursor: pointer;
              > img {
                width: 16px;
              }
              & + .icon-item {
                margin-left: 16px;
              }
            }
          }
          .right-ctrl {
            display: inline-flex;
            align-items: center;
            padding-right: 20px;
            .icon-item {
              width: 32px;
              height: 32px;
              border-radius: 50%;
              > img {
                cursor: pointer;
                width: 32px;
              }
            }
          }
        }
      }
    }
  }
}
</style>
