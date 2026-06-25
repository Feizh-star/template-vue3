<script setup lang="ts">
import { computed } from 'vue'
import { CircleCloseFilled } from '@element-plus/icons-vue'
import { robotTypeDict } from '@/layout/components/AgentModule/config/dict'
import { vAutoTextarea } from '@/directives/v-auto-textarea'
import AutoScrollHoriList from '@/components/AutoScrollHoriList/AutoScrollHoriList.vue'
import AutoScrollHoriListItem from '@/components/AutoScrollHoriList/AutoScrollHoriListItem.vue'
import MessageList from './components/MessageList/MessageList.vue'
import MessageItem from './components/MessageItem/MessageItem.vue'
import MarkdownRenderer from './components/MarkdownRenderer/MarkdownRenderer.vue'
import { loadGithubMarkdownTheme } from '@/compositions/useGithubMarkdownTheme'
import { markdownLoader } from './components/MarkdownRenderer/loader/markdown-loader'
import { useChat } from './compositions/useChat'
import { useChatList } from './compositions/useChatList'
import { useOnline } from './compositions/useOnline'

const props = defineProps<{
  modelValue: boolean
  assistantKey: string
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'update:assistantKey', val: string): void
}>()

const innerVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const robotSence = computed({
  get: () => props.assistantKey,
  set: (val: string) => emit('update:assistantKey', val),
})
const readonlyRobotSence = computed(() => robotSence.value)

const robotSenceItem = computed(
  () => robotTypeDict.find((item) => item.key === robotSence.value) || null
)

const { chatList, imgRef } = useChatList({
  robotSence: readonlyRobotSence,
})

const {
  isStart,
  isChating,
  inputText,
  sendIconUrl,
  messageItems,
  messageListRef,
  popoverRef,
  insertQuestion,
  sendMessage,
  sessionClicked,
  loadHistoryMessages,
  cancelCurrentRequest,
} = useChat({
  robotSence: readonlyRobotSence,
})

const { onlineIconUrl, toggleOnlineSearch } = useOnline()

const dialogOpen = () => {
  isStart.value = true
  isChating.value = false
  inputText.value = ''
  markdownLoader()
  loadGithubMarkdownTheme(false)
}
const dialogClose = () => {
  cancelCurrentRequest()
}
</script>

<template>
  <div class="chat-dialog">
    <el-dialog
      v-model="innerVisible"
      @open="dialogOpen"
      @close="dialogClose"
      draggable
      :close-icon="CircleCloseFilled"
    >
      <template #header>
        <div class="chat-header">
          <div class="chat-title">
            <img src="./assets/chat-title.svg" alt="" />
            <span>灵仔智能体</span>
          </div>
        </div>
      </template>
      <div class="chat-box">
        <Transition name="chat-logo" appear>
          <div class="chat-logo" v-if="isStart">
            <img src="@/layout/components/AgentModule/assets/header-robot.png" alt="" />
            <div class="linear-title">
              <span>弘略致远·象数定能</span>
            </div>
          </div>
        </Transition>
        <div class="chat-sence">
          <div class="sence-tip">
            <span>选择一个场景，开始吧！</span>
          </div>
          <div class="sence-content">
            <el-radio-group class="gap-button fill-gap-button" v-model="robotSence">
              <el-radio-button v-for="item in robotTypeDict" :key="item.key" :value="item.key">
                <img :src="robotSence === item.key ? item.iconSel : item.icon" alt="" />
                <span>{{ item.name }}</span>
              </el-radio-button>
            </el-radio-group>
          </div>
        </div>
        <div class="chat-list" v-if="isChating">
          <MessageList ref="messageListRef">
            <MessageItem
              v-for="item in messageItems"
              :key="item.id"
              :role="item.role"
              :thinking="item.thinking"
              :content="item.content || ''"
            >
              <MarkdownRenderer :content="item.content || ''" />
            </MessageItem>
          </MessageList>
        </div>
        <div
          class="chat-question"
          :class="{ 'not-start': !isStart && !isChating }"
          v-if="isStart || !isChating"
        >
          <div class="question-card">
            <div class="question-title">
              <div class="question-icon">
                <img src="./assets/q1.svg" alt="" />
              </div>
              <div class="question-text">
                <div class="q-title">{{ robotSenceItem?.name || '' }}</div>
                <div class="q-subtitle">{{ robotSenceItem?.desc || '' }}</div>
              </div>
            </div>
            <div class="question-list">
              <AutoScrollHoriList
                v-for="(list, index) in robotSenceItem?.questionList"
                :key="index"
                direction="left"
                :speed="30"
              >
                <AutoScrollHoriListItem v-for="item in list" :key="item.text">
                  <div class="question-item" @click="insertQuestion(item.text)">
                    {{ item.text }}
                  </div>
                </AutoScrollHoriListItem>
              </AutoScrollHoriList>
            </div>
          </div>
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
                @keydown.exact.enter.prevent="sendMessage"
                placeholder="请向灵仔描述您的问题"
              ></textarea>
            </el-scrollbar>
          </div>
          <div class="ctrl-part">
            <div class="left-ctrl">
              <div class="icon-item" @click="toggleOnlineSearch">
                <img :src="onlineIconUrl" alt="" />
              </div>
              <div class="icon-item" ref="imgRef">
                <img src="./assets/history.svg" alt="" />
              </div>
            </div>
            <div class="right-ctrl">
              <div class="icon-item">
                <img :src="sendIconUrl" alt="" @click="sendMessage" />
              </div>
            </div>
          </div>
        </div>
        <el-popover
          ref="popoverRef"
          :virtual-ref="imgRef"
          trigger="click"
          title=""
          placement="top"
          virtual-triggering
          popper-class="el-popper-chat-session-popover"
        >
          <ul class="el-popper-chat-session-list">
            <li
              class="el-popper-chat-session-item"
              v-for="item in chatList"
              :key="item.id"
              @click="sessionClicked(item)"
            >
              <img src="@/layout/components/ChatDialog/assets/history1.svg" alt="" />
              <div class="el-popper-chat-session-title">
                <div class="el-popper-chat-session-text">{{ item.title?.trim() || '未命名' }}</div>
              </div>
            </li>
          </ul>
        </el-popover>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="less" scoped>
.chat-dialog {
  :deep(.el-dialog) {
    --el-dialog-border-radius: 20px;
    --el-message-close-size: 18px;
    --el-dialog-margin-top: 64px;
    width: 60vw;
    height: 82vh;
    max-height: 984px;
    min-height: 724px;
    padding: 0;

    .el-dialog__header {
      height: 52px;
      padding: 11px 20px;
      border-bottom: 1px solid #e5e6eb;
      .el-dialog__headerbtn {
        width: 52px;
        height: 52px;
        display: flex;
        align-items: center;
        justify-content: center;
        &:hover .el-dialog__close {
          color: #6f7276;
        }
      }
    }
    .el-dialog__body {
      height: calc(100% - 52px);
      display: flex;
      justify-content: center;
      padding-top: 20px;
      padding-bottom: 20px;
      background-image: url('./assets/bg.png');
      background-size: 100% 100%;
      background-repeat: no-repeat;
    }
  }
  .chat-header {
    width: 100%;
    height: 100%;
    .chat-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: 'AlibabaPuHuiTi_2_65';
      font-size: 18px;
      font-style: normal;
      font-weight: 500;
      line-height: 24px;
      > img {
        transform: translateY(-1px);
        width: 30px;
      }
    }
  }
  .chat-box {
    width: 80%;
    height: 100%;
    max-width: 800px;
    display: flex;
    flex-direction: column;
    .chat-logo {
      height: 180px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      > img {
        width: 80px;
        height: 80px;
        filter: drop-shadow(1px 3px 5px rgba(0, 0, 0, 0.15));
      }
      .linear-title {
        font-family: 'AlibabaPuHuiTi_2_55';
        text-align: center;
        font-size: 24px;
        font-style: normal;
        font-weight: 600;
        line-height: 24px; /* 100% */
        letter-spacing: 2.4px;
        background: linear-gradient(110deg, #2e68fb 24.38%, #28a9ff 89.47%, #4dfffa 152.01%);
        background-clip: text;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        padding-bottom: 56px;
      }
    }

    .chat-logo-enter-from,
    .chat-logo-leave-to {
      height: 0;
    }
    .chat-logo-enter-active,
    .chat-logo-leave-active {
      transition: height 0.3s ease-in-out;
    }
    .chat-sence {
      .sence-tip {
        color: #7f8c99;
        font-family: 'AlibabaPuHuiTi_2_55';
        font-size: 12px;
        font-style: normal;
        line-height: 16px;
        padding-bottom: 5px;
      }
      .sence-content {
        :deep(.el-radio-group) {
          width: 100%;
          flex-wrap: nowrap;
          gap: 12px;
          .el-radio-button {
            flex: 1;
            padding: 0;
            .el-radio-button__inner > img {
              margin-right: 8px;
              width: 16px;
            }
            .el-radio-button__inner {
              padding: 8px 12px;
              --el-border-color: #e1ebff;
              --el-border: var(--el-border-width) var(--el-border-style) var(--el-border-color);
            }
            &.is-active {
              .el-radio-button__inner {
                --el-border-color: var(--el-color-primary);
                --el-border: var(--el-border-width) var(--el-border-style) var(--el-border-color);
              }
            }
          }
        }
      }
    }
    .chat-question {
      height: 226px;
      overflow: hidden;
      &.not-start {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
      }
      .question-card {
        margin: 24px 0;
        border: 1px solid #ffffff;
        border-radius: 20px;
        background-image: url('./assets/bg1.png');
        background-size: 100% 100%;
        background-repeat: no-repeat;
        padding: 20px;
        .question-title {
          display: flex;
          .question-icon > img {
            width: 36px;
          }
          .question-text {
            padding-left: 8px;
            .q-title {
              color: #0c0c0c;
              font-family: 'AlibabaPuHuiTi_2_65';
              font-size: 17px;
              font-style: normal;
              font-weight: 500;
              line-height: 16px;
              padding-bottom: 8px;
            }
            .q-subtitle {
              color: #45556c;
              font-family: 'AlibabaPuHuiTi_2_55';
              font-size: 13px;
              font-style: normal;
              font-weight: 400;
              line-height: 12px;
            }
          }
        }
        .question-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding-top: 8px;
          .question-item {
            padding: 4px 8px;
            margin-right: 8px;
            justify-content: center;
            align-items: center;
            border-radius: 999px;
            border: 1px solid #fff;
            background: rgba(255, 255, 255, 0.7);
            box-shadow: 0 4px 32px 0 rgba(0, 0, 0, 0.08);
            font-family: 'AlibabaPuHuiTi_2_55';
            font-size: 13px;
            cursor: pointer;
          }
        }
      }
    }
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
</style>

<style lang="less">
.el-popper-chat-session-popover {
  width: 320px !important;

  .el-popper-chat-session-list {
    .el-popper-chat-session-item {
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
      .el-popper-chat-session-title {
        flex: 1;
        min-width: 0;
        .el-popper-chat-session-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    }
  }
}
</style>
