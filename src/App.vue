<template>
  <div id="app">
    <router-view />
    <MemberProfileSetup v-if="!authState.loading && authState.user && !hasMemberProfile" />
  </div>
</template>

<script>
import MemberProfileSetup from './components/MemberProfileSetup.vue'
import { authState } from './services/auth'

export default {
  name: 'App',
  components: { MemberProfileSetup },
  data () { return { authState } },
  computed: {
    hasMemberProfile () {
      return Boolean(authState.memberProfile && authState.memberProfile.customerName && authState.memberProfile.phone)
    }
  }
}
</script>
