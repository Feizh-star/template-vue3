<script setup lang="ts">
import { computed } from 'vue'

export type TagType = 'blue' | 'green' | 'custom'

export interface StatCardProps {
  /** 卡片标题，如"预测峰值" */
  title: string
  /** 主数值，如 111.3 */
  value: string | number
  /** 主数值单位，如 "MW"、"%" */
  unit?: string
  /** 左侧图标 */
  icon?: string
  /** 标签类型：blue=蓝色边框标签 / green=绿色圆点+边框标签 / custom=纯边框标签 */
  tagType?: TagType
  /** 标签文本，如 "MW"、"MWh"、"正常" */
  tagText?: string
  /** 标签文本颜色（tagType 为 custom 时生效） */
  tagTextColor?: string
  /** 标签边框颜色（tagType 为 custom 时生效） */
  tagBorderColor?: string
  /** 底部描述文本，如 "较当前出力 +17.7MW" */
  description?: string
  /** 底部描述文本颜色，默认 #4e5866 */
  descriptionColor?: string
}

const props = withDefaults(defineProps<StatCardProps>(), {
  unit: '',
  icon: '',
  tagType: 'blue',
  tagText: '',
  tagTextColor: '#578af1',
  tagBorderColor: 'rgba(87,138,241,0.4)',
  description: '',
  descriptionColor: '#4e5866',
})

const isGreenTag = computed(() => props.tagType === 'green')
const isBlueTag = computed(() => props.tagType === 'blue')
</script>

<template>
  <div class="stat-card">
    <div class="stat-card__inner">
      <!-- 左侧图标 -->
      <div v-if="icon" class="stat-card__icon">
        <img :src="icon" alt="" />
      </div>

      <!-- 右侧内容 -->
      <div class="stat-card__content">
        <!-- 左列：标题 + 数值 -->
        <div class="stat-card__main">
          <span class="stat-card__title">{{ title }}</span>
          <div class="stat-card__value-row">
            <span class="stat-card__value">{{ value }}</span>
            <span v-if="unit" class="stat-card__unit">{{ unit }}</span>
          </div>
        </div>

        <!-- 右列：标签 + 描述 -->
        <div class="stat-card__extra">
          <!-- 蓝色标签 -->
          <span v-if="isBlueTag && tagText" class="stat-card__tag stat-card__tag--blue">
            {{ tagText }}
          </span>

          <!-- 绿色圆点标签 -->
          <span v-else-if="isGreenTag && tagText" class="stat-card__tag stat-card__tag--green">
            <span class="stat-card__tag-dot">
              <span class="stat-card__tag-dot-bg"></span>
              <span class="stat-card__tag-dot-core"></span>
            </span>
            {{ tagText }}
          </span>

          <!-- 自定义标签（通过插槽或自定义颜色） -->
          <span v-else-if="tagText" class="stat-card__tag stat-card__tag--custom" :style="{ color: tagTextColor, borderColor: tagBorderColor }">
            <slot name="tag">{{ tagText }}</slot>
          </span>

          <!-- 标签插槽：完全自定义标签内容 -->
          <slot name="tag" />

          <!-- 底部描述 -->
          <span v-if="description || $slots.description" class="stat-card__desc" :style="{ color: descriptionColor }">
            <slot name="description">{{ description }}</slot>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.stat-card {
  flex: 1 0 0;
  min-width: 0;
  height: 80px;
  background: #f7f8fa;
  border: 0.5px solid #fff;
  border-radius: 6px;
  padding: 8px 16px 8px 8px;
  box-sizing: border-box;

  &__inner {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 100%;
  }

  &__icon {
    flex-shrink: 0;
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;

    img {
      width: 60px;
      height: 60px;
      object-fit: contain;
    }
  }

  &__content {
    flex: 1 0 0;
    min-width: 0;
    display: flex;
    align-items: flex-end;
    gap: 12px;
  }

  &__main {
    flex: 1 0 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    word-break: break-word;
  }

  &__title {
    font-size: 14px;
    line-height: 14px;
    color: #4e5866;
    font-weight: 500;
  }

  &__value-row {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    white-space: nowrap;
  }

  &__value {
    font-size: 24px;
    line-height: 18px;
    color: #222630;
    font-weight: 700;
    font-family: 'D-DIN', 'DIN-Bold', sans-serif;
  }

  &__unit {
    font-size: 14px;
    line-height: 14px;
    color: #7f8793;
    font-weight: 400;
  }

  &__extra {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: center;
    gap: 12px;
  }

  &__tag {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 2px 6px;
    border-radius: 9999px;
    font-size: 12px;
    line-height: 12px;
    font-weight: 500;
    white-space: nowrap;
    background: #fff;

    &--blue {
      color: #578af1;
      border: 1px solid rgba(87, 138, 241, 0.4);
    }

    &--green {
      color: #008236;
      border: 1px solid rgba(0, 201, 80, 0.4);
      padding-left: 4px;
    }

    &--custom {
      background: #fff;
      border: 1px solid;
    }
  }

  &__tag-dot {
    position: relative;
    width: 8px;
    height: 8px;
    flex-shrink: 0;
  }

  &__tag-dot-bg {
    position: absolute;
    inset: 0;
    background: #05df72;
    opacity: 0.1;
    border-radius: 9999px;
  }

  &__tag-dot-core {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 4px;
    height: 4px;
    background: #00c950;
    border-radius: 9999px;
  }

  &__desc {
    font-size: 14px;
    line-height: 14px;
    font-weight: 500;
    white-space: nowrap;
    word-break: break-word;
  }
}
</style>
