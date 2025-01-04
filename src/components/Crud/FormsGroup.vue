<script lang="tsx">
import { defineComponent, resolveComponent } from 'vue'
import type { PropType } from 'vue'
import type { IFormConfig } from './types/common'

export default defineComponent({
  name: 'FormGroup',
  data() {
    return {
      rules: {},
      customRules: {},
      customErrorMsg: {},
    }
  },
  props: {
    forms: {
      type: Array as PropType<IFormConfig[]>,
      required: true,
    },
    formData: {
      type: Object as PropType<Record<string, any>>,
      required: true,
    },
  },
  render() {
    console.log(this.forms, this.formData)
    const formItemComponent = resolveComponent('el-input')
    return <formItemComponent />
  },
})
</script>
