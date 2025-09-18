document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  const modal = document.getElementById("analysisModal");
  const closeBtn = document.getElementById("modal-close");
  const steps = document.querySelectorAll(".modal-step");

  let selectedDong = "";
  let selectedIndustry = "";
  let selectedFloor = "";
  let selectedSize = "";

  // =====================
  // 🔹 모달 열기/닫기
  // =====================
  function openModal() {
    if (selectedDong && selectedIndustry) {
      console.log("📌 모달 열기 조건 충족:", selectedDong, selectedIndustry); // 디버깅용
      modal.style.display = "flex"; // ✅ flex 적용
      showStep(0);
    } else {
      console.log("⚠️ 조건 불충족:", selectedDong, selectedIndustry);
    }
  }

  function closeModal() {
    modal.style.display = "none";
    selectedFloor = "";
    selectedSize = "";
    document.getElementById("summary-list").innerHTML = "";
  }

  function showStep(index) {
    steps.forEach((step, i) => {
      step.style.display = i === index ? "block" : "none";
    });
  }

  // =====================
  // 🔹 동 + 업태 선택 로직
  // =====================
  const dongSelect = document.getElementById("dong-select");
  const industryTabs = document.querySelectorAll(".filter-tab");

  // 동 선택
  dongSelect.addEventListener("change", function () {
    selectedDong = this.value;
    console.log("✅ 선택된 동:", selectedDong);
    checkSelections();
  });

  // 업태 선택
  industryTabs.forEach(tab => {
    tab.addEventListener("click", function () {
      industryTabs.forEach(t => t.classList.remove("active"));
      this.classList.add("active");
      selectedIndustry = this.textContent;
      console.log("✅ 선택된 업태:", selectedIndustry);
      checkSelections();
    });
  });

  // 공통 체크 함수
  function checkSelections() {
    if (selectedDong && selectedIndustry) {
      openModal();
    }
  }

  // =====================
  // 🔹 닫기 버튼 이벤트
  // =====================
  closeBtn.addEventListener("click", closeModal);
  document.querySelectorAll(".close-btn").forEach(btn =>
    btn.addEventListener("click", closeModal)
  );
});
