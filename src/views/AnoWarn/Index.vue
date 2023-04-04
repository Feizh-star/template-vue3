<template>
  <div class="ano-warn">
    <section class="warning-search">
      <el-form :inline="true" :model="formInline" class="demo-form-inline">
        <el-form-item label="记录标志:">
          <el-input v-model="formInline.recordMarker" placeholder="请输入记录标志"></el-input>
        </el-form-item>
        <el-form-item label="告警级别:">
          <el-select v-model="formInline.warningLevel" placeholder="告警级别">
            <el-option label="全部" value="all"></el-option>
            <el-option label="危险告警" value="danger"></el-option>
            <el-option label="故障告警" value="wrong"></el-option>
            <el-option label="一般告警" value="general"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onSubmit" class="custom-primary">查询</el-button>
        </el-form-item>
      </el-form>
    </section>
    <section class="warning-table">
      <el-table
        ref="multipleTable"
        :data="table.tableData"
        tooltip-effect="dark"
        style="width: 100%"
        height="100%"
        :header-cell-style="{ backgroundColor: '#F1F4F8', color: defaultStyle.textColor, fontWeight: 'bold' }"
        @selection-change="handleSelectionChange">
        <el-table-column
          type="selection"
          align="center"
          width="55">
        </el-table-column>
        <el-table-column
          label="序号"
          type="index"
          align="center"
          width="55"
        ></el-table-column>
        <el-table-column
          prop="marker"
          label="标志"
          align="center"
          width="120">
        </el-table-column>
        <el-table-column
          prop="type"
          label="类型"
          align="center"
          width="120">
          <template v-slot="scope">
            <span :style="{ color: getTypeColor(scope.row.type)}">{{ scope.row.type }}</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="level"
          label="级别"
          align="center"
          width="120">
          <template v-slot="scope">
            <span :style="{ color: getLevelColor(scope.row.level)}">{{ scope.row.level }}</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="status"
          label="状态"
          align="center"
          width="120">
          <template v-slot="scope">
            <span :style="{ color: getStatusColor(scope.row.status)}">{{ scope.row.status }}</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="content"
          show-overflow-tooltip
          label="内容"
          align="center"
          min-width="120">
        </el-table-column>
        <el-table-column
          label="故障发生时间"
          show-overflow-tooltip
          align="center"
          width="180">
          <template v-slot="scope">{{ scope.row.occurTime }}</template>
        </el-table-column>
        <el-table-column
          label="持续时间"
          show-overflow-tooltip
          align="center"
          width="180">
          <template v-slot="scope">{{ scope.row.durationTime }}</template>
        </el-table-column>
        <el-table-column
          label="操作"
          align="center"
          width="200">
          <template #default>
            <el-button link size="small">
              <span class="custom-icon-advice"></span>
              <span class="opt-btn">运维建议</span>
            </el-button>
            <el-button link size="small">
              <span class="custom-icon-task"></span>
              <span class="opt-btn">处理</span>
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>
    <section class="warning-pagination">
      <el-pagination
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
        :current-page="currentPage"
        :page-sizes="[20, 30, 50]"
        :page-size="pageSize"
        layout="total, sizes, prev, pager, next, jumper"
        :total="total">
      </el-pagination>
    </section>
  </div>
</template>

<script setup lang="ts">
import { defaultStyle } from '@/style/variables'
const formInline = reactive({
  recordMarker: '',
  warningLevel: 'all'
})
const table = reactive({
  tableData: [{
    marker: '192.168.1.103',
    type: '内存告警',
    level: '故障告警',
    status: '待处理',
    content: '内存使用率达到98%，请及时处理',
    occurTime: '20220808 08:10:12',
    durationTime: '29天23小时15分钟',
  }, {
    marker: '192.168.1.104',
    type: 'cpu告警',
    level: '一般告警',
    status: '待处理',
    content: '内存使用率达到98%，请及时处理',
    occurTime: '20220808 08:10:12',
    durationTime: '24小时',
  }, {
    marker: '192.168.1.104',
    type: '容量告警',
    level: '危险告警',
    status: '待处理',
    content: '内存使用率达到98%，请及时处理',
    occurTime: '20220808 08:10:12',
    durationTime: '24小时',
  }],
  multipleSelection: [] as any[],
})

const currentPage = ref(1)
const total = ref(0)
const pageSize = ref(30)
onBeforeMount(() => {
  total.value = table.tableData.length
})
function onSubmit() {
  console.log('submit!');
}
// 表格
function handleSelectionChange(val: any[]) {
  table.multipleSelection = val;
}
// 分页
function handleSizeChange(val: number) {
  console.log(`每页 ${val} 条`);
  pageSize.value = val
  currentPage.value = 1
  // 重新获取数据
  total.value = table.tableData.length
}
function handleCurrentChange(val: number) {
  console.log(`当前页: ${val}`);
  currentPage.value = val
  // 重新获取数据
  total.value = table.tableData.length
}
/**
 * 获取颜色
 */
function getTypeColor(type: string) {
  let color = ''
  switch (type) {
    case '内存告警':
      color = '#DA1799'
      break
    case 'cpu告警':
      color = '#DA1799'
      break
    case '容量告警':
      color = '#DA1799'
      break
    default:
      color = defaultStyle.textColor
  }
  return color
}
function getLevelColor(level: string) {
  let color = ''
  switch (level) {
    case '故障告警':
      color = '#FF9200'
      break
    case '一般告警':
      color = '#71B300'
      break
    case '危险告警':
      color = '#FC0000'
      break
    default:
      color = defaultStyle.textColor
  }
  return color
}
function getStatusColor(status: string) {
  let color = ''
  switch (status) {
    case '待处理':
    case '已处理':
      color = '#429FFF'
      break
    default:
      color = defaultStyle.textColor
  }
  return color
}
</script>

<style lang="scss" scoped>
$pagination-height: 48px; // 分页器高度
.ano-warn {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  padding: 16px 24px;

  .warning-search {
    
  }
  .warning-table {
    flex: 1;
    min-height: 0;
    .opt-btn {
      font-size: 16px;
      display: inline-block;
      padding-left: 5px;
      color: $text-color;
    }
    .custom-icon-advice,
    .custom-icon-task {
      background-size: cover;
      display: inline-block;
      width: 13px;
      height: 16px;
      vertical-align: bottom;
    }
    .custom-icon-advice {
      background-image: url("@/assets/images/投诉建议@2x.png");
    }
    .custom-icon-task {
      background-image: url("@/assets/images/任务处理@2x.png");
    }
  }
  .warning-pagination {
    height: $pagination-height;
    display: flex;
    justify-content: flex-end;
    align-items: center;
  }
}
.custom-primary {
  transform: translateY(-1px);
  width: 80px;
}
</style>