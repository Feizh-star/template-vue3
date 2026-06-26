import onlineIcon from '../assets/online.svg'
import onlineGreyIcon from '../assets/online-grey.svg'

export function useOnline() {
  const isOnlineSearch = ref(false)
  const onlineIconUrl = computed(() => (isOnlineSearch.value ? onlineIcon : onlineGreyIcon))
  const toggleOnlineSearch = () => (isOnlineSearch.value = !isOnlineSearch.value)
  return {
    isOnlineSearch,
    onlineIconUrl,
    toggleOnlineSearch,
  }
}
