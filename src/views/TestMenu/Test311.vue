<script setup lang="ts">
import StatCard from '@/components/StatCard/Index.vue'
import iconPeak from '@/assets/images/stat-card/icon-peak.png'
import iconEnergy from '@/assets/images/stat-card/icon-energy.png'
import iconCapacity from '@/assets/images/stat-card/icon-capacity.png'
</script>

<template>
  <div class="test-menu">
    <div class="card-row">
      <!-- 卡片1：预测峰值 — 蓝色标签 + 绿色描述 -->
      <StatCard
        title="预测峰值"
        :value="111.3"
        unit="MW"
        :icon="iconPeak"
        tag-type="blue"
        tag-text="MW"
        description="较当前出力 +17.7MW"
        description-color="#00c950"
      />

      <!-- 卡片2：预测电量 — 绿色圆点标签 + 灰色描述 -->
      <StatCard
        title="预测电量"
        :value="848.4"
        unit="MWh"
        :icon="iconEnergy"
        tag-type="green"
        tag-text="MWh"
        description="预测窗口 24h"
      />

      <!-- 卡片3：容量利用率 — 自定义标签 + 灰色描述 -->
      <StatCard
        title="容量利用率"
        :value="92.7"
        unit="%"
        :icon="iconCapacity"
        tag-type="custom"
        tag-text="正常"
        tag-text-color="#008236"
        tag-border-color="rgba(0,201,80,0.4)"
        description="可利用率 96.8%"
      />
    </div>
  </div>
</template>

<style scoped lang="less">
.test-menu {
  width: 100%;
  height: 100%;
  background-color: #fff;
  padding: 16px;
  box-sizing: border-box;
}

.card-row {
  display: flex;
  gap: 16px;
  width: 100%;
}
</style>
