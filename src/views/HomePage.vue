<template>
  <main>
    <header class="site-header">
      <a class="brand" href="#top" aria-label="𝚗𝚊𝚗𝚞. 首頁">
        <span>𝚗𝚊𝚗𝚞.</span>
      </a>
      <nav class="desktop-nav" aria-label="主導覽">
        <a href="#about">NOTES</a><a href="#services">SERVICES</a>
        <a href="#portfolio">COLLECTION</a>
        <a href="https://line.me/R/ti/p/%40340zmevl" target="_blank" rel="noopener noreferrer">LINE</a>
        <a href="https://www.instagram.com/nanu_nail_/" target="_blank" rel="noopener noreferrer">INSTAGRAM</a>
      </nav>
      <AuthControl class="header-auth" />
      <button
        class="menu-toggle"
        type="button"
        :aria-expanded="mobileMenuOpen ? 'true' : 'false'"
        aria-controls="mobile-navigation"
        :aria-label="mobileMenuOpen ? '關閉導覽選單' : '開啟導覽選單'"
        @click="mobileMenuOpen = !mobileMenuOpen"
      >
        <span></span><span></span>
      </button>
      <nav v-if="mobileMenuOpen" id="mobile-navigation" class="mobile-nav" aria-label="手機主導覽">
        <a href="#about" @click="mobileMenuOpen = false">NOTES</a>
        <a href="#services" @click="mobileMenuOpen = false">SERVICES</a>
        <a href="#portfolio" @click="mobileMenuOpen = false">COLLECTION</a>
        <a href="https://line.me/R/ti/p/%40340zmevl" target="_blank" rel="noopener noreferrer" @click="mobileMenuOpen = false">LINE</a>
        <a href="https://www.instagram.com/nanu_nail_/" target="_blank" rel="noopener noreferrer" @click="mobileMenuOpen = false">INSTAGRAM</a>
        <router-link class="mobile-booking-link" to="/booking" @click.native="mobileMenuOpen = false">BOOK NOW</router-link>
        <AuthControl class="mobile-auth" />
      </nav>
    </header>

    <section id="top" class="hero">
      <div class="hero-copy">
        <p class="eyebrow">nail design / private stuido</p>
        <h1>A little light<br><em>Entirely your own</em></h1>
        <p class="hero-description">在細微之處，收藏屬於自己的光</p>
        <router-link class="button button-dark" to="/booking">開始預約</router-link>
      </div>
      <div class="hero-image" role="group" aria-label="首頁作品圖片輪播">
        <img
          v-for="(image, index) in heroImages"
          :key="image"
          class="hero-slide"
          :class="{ 'hero-slide--active': index === heroImageIndex }"
          :src="image"
          :alt="`美甲作品 ${index + 1}`"
          :aria-hidden="index === heroImageIndex ? 'false' : 'true'"
        >
      </div>
      <div class="hero-index">SINCE. 2026</div>
    </section>

    <section id="about" class="intro section-wrap">
      <p class="eyebrow">BOOKING NOTES</p>
      <h2>預約前，請先留意</h2>
      <div class="booking-note-details">
        <p>♡ 預約送出後會先由店家確認，確認後才算成立</p>
        <p>♡ 若需更改或取消，請提前2日透過官方LINE聯繫</p>
        <p>♡ 自由發揮需完全信任，可提供色系、元素或靈感圖，例如：白色系、珍珠、透透感</p>
        <p>♡ 自帶圖片可先傳圖報價，因材料與技法不同，無法保證 100% 相同</p>
        <hr>
        <ol>
          <li>全預約制，請勿攜伴</li>
          <li>凝膠施作約 2.5 小時，卸甲續作約 3.5 小時</li>
          <li>遲到 10 分鐘僅能施作單色，遲到 15 分鐘視同取消預約</li>
          <li>目前不接足部美甲、問題甲</li>
          <li>現場僅接受現金支付、網銀轉帳</li>
          <li>無法久坐、趕時間、完美主義者，請斟酌預約，敬請見諒🙇‍♀️</li>
        </ol>
        <hr>
        <p>近乙未保台公園、壢新醫院｜預約成功給詳細地址</p>
      </div>
    </section>

    <section id="services" class="services section-wrap">
      <div class="section-heading"><div><p class="eyebrow">OUR SERVICES</p></div><p>{{ catalogErrorMessage || (catalogServicesLoaded ? '服務與價格依店家目前提供的項目為準。' : '尚未載入店家服務時，以下為暫定展示內容。') }}</p></div>
      <div class="service-grid">
        <article v-for="(service, index) in services" :key="service.name" class="service-card">
          <span class="service-number">0{{ index + 1 }}</span>
          <div><h3>{{ service.name }}</h3><p>{{ service.description }}</p></div>
          <div class="service-meta"><strong>{{ Number(service.price) === 0 ? '私訊報價' : `NT$ ${service.price}` }}</strong><span>{{ formatDuration(Math.max(0, Number(service.durationMinutes || service.duration) - 30)) }}</span></div>
          <router-link class="service-arrow" to="/booking" :aria-label="`預約${service.name}`">↗</router-link>
        </article>
      </div>
    </section>

    <section id="portfolio" class="portfolio section-wrap">
      <div class="section-heading"><div><p class="eyebrow">COLLECTION</p></div><p>{{ catalogErrorMessage || (catalogWorksLoaded ? '皆為客人實際作品，呈現真實施作樣貌。' : '以下為風格示意，請替換成店家授權作品。') }}</p></div>
      <div class="portfolio-grid">
        <article v-for="(work, index) in works" :key="work.id || work.title" class="work-card" :class="`work-${index + 1}`">
          <button class="work-preview" type="button" :aria-label="`放大查看${work.title}作品示意`" @click="selectedWork = work">
            <div class="work-art" :class="work.visual"><img v-if="work.imageURL" :src="work.imageURL" :alt="work.alt || work.title"><span v-else>{{ work.art || '✳' }}</span></div>
          </button>
          <div class="work-caption"><h3>{{ work.title }}</h3></div>
        </article>
      </div>
      <div v-if="selectedWork" class="work-lightbox" role="dialog" aria-modal="true" :aria-label="`${selectedWork.title}作品示意`" @click.self="selectedWork = null">
        <div class="lightbox-content">
          <button class="lightbox-close" type="button" aria-label="關閉作品預覽" @click="selectedWork = null">關閉 ×</button>
          <div class="work-art lightbox-art" :class="selectedWork.visual"><img v-if="selectedWork.imageURL" :src="selectedWork.imageURL" :alt="selectedWork.alt || selectedWork.title"><span v-else>{{ selectedWork.art || '✳' }}</span></div>
          <div class="work-caption"><h3>{{ selectedWork.title }}</h3></div>
        </div>
      </div>
    </section>

    <footer id="member" class="site-footer">
      <div><a class="brand footer-brand" href="#top"><span>𝚗𝚊𝚗𝚞.</span></a><p>An unhurried moment, where beauty quietly unfolds.</p></div>
      <div class="footer-info"><p>近乙未保台公園、壢新醫院｜預約成功給詳細地址</p><a href="#top">回到頁首 ↑</a></div>
      <div class="footer-bottom"><span>© 2026 𝚗𝚊𝚗𝚞.</span><span>MADE WITH CARE</span></div>
    </footer>
  </main>
</template>

<script>
import AuthControl from '../components/AuthControl.vue'
import { firebaseConfigured } from '../services/firebase'
import { getPortfolioWorks, getServices } from '../services/catalog'
import formatDuration from '../utils/formatDuration'

export default {
  name: 'HomePage',
  components: { AuthControl },
  data () {
    return {
      mobileMenuOpen: false,
      heroImageIndex: 0,
      heroSlideTimer: null,
      selectedWork: null,
      catalogServicesLoaded: false,
      catalogWorksLoaded: false,
      catalogErrorMessage: '',
      services: [
        { name: '經典單色', description: '為日常添上一抹溫柔色彩。', price: '1,200', duration: 60 },
        { name: '細緻法式', description: '俐落線條，描繪耐看的優雅。', price: '1,500', duration: 60 },
        { name: '個性設計', description: '以喜愛的靈感，完成專屬款式。', price: '1,800 起', duration: 60 }
      ],
      works: [
        { title: '奶霧裸粉', category: '簡約日常', art: '01', visual: 'art-1' },
        { title: '柔光法式', category: '經典法式', art: '02', visual: 'art-2' },
        { title: '暖金微光', category: '貓眼光澤', art: '03', visual: 'art-3' }
      ]
    }
  },
  computed: {
    heroImages () {
      return [1, 2, 3].map(index => `${process.env.BASE_URL}nail%20(${index}).jpg`)
    }
  },
  created () {
    if (firebaseConfigured) this.loadCatalog()
  },
  mounted () {
    this.heroSlideTimer = window.setInterval(() => {
      this.heroImageIndex = (this.heroImageIndex + 1) % this.heroImages.length
    }, 5000)
  },
  beforeDestroy () {
    window.clearInterval(this.heroSlideTimer)
  },
  methods: {
    formatDuration,
    async loadCatalog () {
      try {
        const [services, works] = await Promise.all([getServices(), getPortfolioWorks()])
        if (services.length) {
          this.services = services
          this.catalogServicesLoaded = true
        }
        if (works.length) {
          this.works = works
          this.catalogWorksLoaded = true
        }
      } catch (error) {
        this.catalogServicesLoaded = false
        this.catalogWorksLoaded = false
        this.catalogErrorMessage = error ? '暫時無法載入店家資料，目前顯示暫定內容。' : ''
      }
    }
  }
}
</script>
