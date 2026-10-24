<template>
  <main>
    <header class="site-header">
      <a class="brand" href="#top" aria-label="𝚗𝚊𝚗𝚞. 首頁">
        <span>𝚗𝚊𝚗𝚞.</span>
      </a>
      <nav class="desktop-nav" aria-label="主導覽">
        <a href="#about">關於我們</a><a href="#services">服務項目</a>
        <a href="#portfolio">作品欣賞</a><a href="#booking-notes">預約須知</a>
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
        <a href="#about" @click="mobileMenuOpen = false">關於我們</a>
        <a href="#services" @click="mobileMenuOpen = false">服務項目</a>
        <a href="#portfolio" @click="mobileMenuOpen = false">作品欣賞</a>
        <a href="#booking-notes" @click="mobileMenuOpen = false">預約須知</a>
        <router-link to="/booking" @click.native="mobileMenuOpen = false">立即預約</router-link>
        <AuthControl class="mobile-auth" />
      </nav>
    </header>

    <section id="top" class="hero">
      <div class="hero-copy">
        <p class="eyebrow">A LITTLE TIME FOR YOURSELF</p>
        <h1>讓日常的每一刻，<br><em>都從指尖開始溫柔。</em></h1>
        <p class="hero-description">為自己留一點時間，在柔和色彩與細緻工藝裡，找到剛剛好的日常美感。</p>
        <router-link class="button button-dark" to="/booking">預約一段美好時光</router-link>
        <p class="hero-note">服務資訊為暫定內容，正式開放預約前可再修改。</p>
      </div>
      <div class="hero-image" :style="heroImageStyle" role="img" aria-label="柔和色調的美甲工作室情境照片">
      </div>
      <div class="hero-index">EST. WITH CARE <span>✳</span> TAIWAN</div>
    </section>

    <section id="about" class="intro section-wrap">
      <p class="eyebrow">THE STUDIO</p>
      <h2>細節裡的用心，<br>讓喜歡的風格自然發生。</h2>
      <p>𝚗𝚊𝚗𝚞. 以日常美感為靈感。從色彩、線條到每一個小細節，陪你找到自在又耐看的指尖風格。</p>
      <a class="text-link" href="#portfolio">看看我們的作品</a>
    </section>

    <section id="services" class="services section-wrap">
      <div class="section-heading"><div><p class="eyebrow">OUR SERVICES</p><h2>為今天，挑一種喜歡。</h2></div><p>{{ catalogErrorMessage || (catalogServicesLoaded ? '服務與價格依店家目前提供的項目為準。' : '尚未載入店家服務時，以下為暫定展示內容。') }}</p></div>
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
      <div class="section-heading"><div><p class="eyebrow">SELECTED WORKS</p><h2>把喜歡，留在指尖。</h2></div><p>{{ catalogErrorMessage || (catalogWorksLoaded ? '作品圖片與分類由店家管理。' : '以下為風格示意，請替換成店家授權作品。') }}</p></div>
      <div class="portfolio-filters" aria-label="依作品風格篩選">
        <button
          v-for="category in workCategories"
          :key="category"
          type="button"
          :class="{ active: selectedWorkCategory === category }"
          :aria-pressed="selectedWorkCategory === category ? 'true' : 'false'"
          @click="selectedWorkCategory = category"
        >{{ category }}</button>
      </div>
      <div class="portfolio-grid">
        <article v-for="(work, index) in filteredWorks" :key="work.id || work.title" class="work-card" :class="`work-${index + 1}`">
          <button class="work-preview" type="button" :aria-label="`放大查看${work.title}作品示意`" @click="selectedWork = work">
            <div class="work-art" :class="work.visual" :style="work.imageURL ? { backgroundImage: `url(${work.imageURL})` } : null"><span v-if="!work.imageURL">{{ work.art || '✳' }}</span></div>
          </button>
          <div class="work-caption"><h3>{{ work.title }}</h3><span>{{ work.category }}</span></div>
        </article>
      </div>
      <div v-if="selectedWork" class="work-lightbox" role="dialog" aria-modal="true" :aria-label="`${selectedWork.title}作品示意`" @click.self="selectedWork = null">
        <div class="lightbox-content">
          <button class="lightbox-close" type="button" aria-label="關閉作品預覽" @click="selectedWork = null">關閉 ×</button>
          <div class="work-art lightbox-art" :class="selectedWork.visual" :style="selectedWork.imageURL ? { backgroundImage: `url(${selectedWork.imageURL})` } : null"><span v-if="!selectedWork.imageURL">{{ selectedWork.art || '✳' }}</span></div>
          <div class="work-caption"><h3>{{ selectedWork.title }}</h3><span>{{ selectedWork.category }} · 風格示意</span></div>
        </div>
      </div>
    </section>

    <section id="booking-notes" class="booking-band">
      <p class="eyebrow">BOOKING NOTES</p><h2>慢慢挑選，<br>再把時段留給自己。</h2>
      <router-link class="button button-light" to="/booking">選擇服務並預約</router-link>
      <p class="policy-note">取消需由管理員協助。其他預約規則、遲到及付款政策仍待店家確認。</p>
    </section>

    <footer id="member" class="site-footer">
      <div><a class="brand footer-brand" href="#top"><span>𝚗𝚊𝚗𝚞.</span></a><p>留一點時間，讓喜歡慢慢發生。</p></div>
      <div class="footer-info"><p>聯絡資訊、地址、營業時間與社群連結<br>皆為待替換的暫定資料。</p><a href="#top">回到頁首 ↑</a></div>
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
      selectedWorkCategory: '全部',
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
    heroImageStyle () {
      return {
        backgroundImage: `linear-gradient(160deg,rgba(48,42,39,.03),rgba(48,42,39,.16)),url("${process.env.BASE_URL}banner.jpg")`
      }
    },
    workCategories () {
      return ['全部', ...new Set(this.works.map(work => work.category).filter(Boolean))]
    },
    filteredWorks () {
      if (this.selectedWorkCategory === '全部') return this.works
      return this.works.filter(work => work.category === this.selectedWorkCategory)
    }
  },
  created () {
    if (firebaseConfigured) this.loadCatalog()
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
          this.selectedWorkCategory = '全部'
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
