document.addEventListener('DOMContentLoaded', function () {
    const analysisModal = document.getElementById('analysisModal');
    const modalOpenBtn = document.getElementById('show-analysis-modal');
    const modalCloseBtn = document.getElementById('analysis-modal-close');
    const modalSteps = document.querySelectorAll('.modal-step');
    const optionBtns = document.querySelectorAll('.option-btn');
    
    let selectedFloor = null;

    // 모달 열기
    modalOpenBtn.addEventListener('click', () => {
        analysisModal.style.display = 'flex';
        showStep(1);
    });

    // 모달 닫기
    modalCloseBtn.addEventListener('click', () => {
        analysisModal.style.display = 'none';
    });

    // 층수 선택 버튼 클릭 이벤트
    optionBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            selectedFloor = this.dataset.value;
            alert(`선택된 층수: ${selectedFloor}층`);
            showStep(2); // 다음 단계로 이동
        });
    });

    // 특정 모달 단계 보여주기
    function showStep(stepNumber) {
        modalSteps.forEach(step => {
            step.style.display = 'none';
        });
        document.getElementById(`step${stepNumber}`).style.display = 'block';
    }

    // 이 외에 최종 폼 제출 시 선택된 값들을 처리하는 로직을 추가해야 합니다.
    // 예: const analysisForm = document.getElementById('analysis-form-modal');
    // analysisForm.addEventListener('submit', function() { ... });
});