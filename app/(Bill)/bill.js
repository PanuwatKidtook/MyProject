import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function BillScreen() {
  const router = useRouter();
  const [selectedBill, setSelectedBill] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('qr');

  const bills = [
    {
      id: 'BILL-001',
      roomNo: '204',
      month: 'มิถุนายน 2569',
      title: 'บิลรวมประจำเดือน',
      amount: 4180,
      status: 'unpaid',
      dueDate: '30 มิ.ย. 2569',
      category: 'summary',
      details: [
        { label: 'ค่าเช่าห้อง', value: 3500, icon: 'home-outline', color: '#0F7EE6' },
        { label: 'ค่าน้ำ', value: 120, icon: 'water-outline', color: '#06B6D4' },
        { label: 'ค่าไฟ', value: 560, icon: 'flash-outline', color: '#F59E0B' },
      ],
    },
  ];

  const total = useMemo(() => bills.reduce((sum, item) => sum + item.amount, 0), [bills]);
  const paidTotal = 0;
  const unpaidTotal = total;

  const getStatusText = (status) => {
    if (status === 'paid') return 'ชำระแล้ว';
    if (status === 'unpaid') return 'ยังไม่ชำระ';
    return 'รอตรวจสอบ';
  };

  const getStatusColor = (status) => {
    if (status === 'paid') return '#10B981';
    if (status === 'unpaid') return '#EF4444';
    return '#F59E0B';
  };

  const openPayModal = () => {
    setSelectedMethod('qr');
    setShowPayModal(true);
  };

  const bill = bills[0];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F7EE6" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>บิลรวม</Text>
          <Text style={styles.headerSub}>รวมค่าเช่าห้อง ค่าน้ำ และค่าไฟ</Text>
        </View>

        <TouchableOpacity style={styles.profileButton}>
          <Ionicons name="person-circle-outline" size={28} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabel}>ห้องพัก</Text>
              <Text style={styles.heroRoom}>204</Text>
              <Text style={styles.heroMonth}>ประจำเดือน มิถุนายน 2569</Text>
            </View>

            <View style={styles.heroIconBox}>
              <MaterialCommunityIcons name="receipt-text-outline" size={36} color="white" />
            </View>
          </View>

          <View style={styles.totalCard}>
            <View style={styles.totalRowTop}>
              <Text style={styles.totalLabel}>ยอดบิลรวม</Text>
              <View style={styles.totalBadge}>
                <Text style={styles.totalBadgeText}>{getStatusText(bill.status)}</Text>
              </View>
            </View>
            <Text style={styles.totalValue}>฿{total.toLocaleString()}</Text>
            <Text style={styles.totalHint}>กดชำระทีเดียวได้เลย</Text>

            <View style={styles.smallSummaryRow}>
              <MiniSummary label="ชำระแล้ว" value={`฿${paidTotal.toLocaleString()}`} />
              <MiniSummary label="ค้างชำระ" value={`฿${unpaidTotal.toLocaleString()}`} danger />
            </View>
          </View>
        </View>

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>รายละเอียดบิลรวม</Text>
          <Text style={styles.sectionSubtitle}>{bill.details.length} รายการ</Text>
        </View>

        <View style={styles.billCard}>
          <View style={styles.billCardHeader}>
            <View style={styles.billLeft}>
              <View style={styles.billIconBox}>
                <Ionicons name="document-text-outline" size={22} color="#0F7EE6" />
              </View>
            </View>

            <View style={styles.billMiddle}>
              <Text style={styles.billTitle}>{bill.title}</Text>
              <Text style={styles.billMeta}>ห้อง {bill.roomNo} • {bill.month}</Text>
              <Text style={styles.billDue}>กำหนดชำระ: {bill.dueDate}</Text>
            </View>

            <View style={styles.billRight}>
              <Text style={styles.billAmount}>฿{bill.amount.toLocaleString()}</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(bill.status) + '20' }]}>
                <Text style={[styles.statusBadgeText, { color: getStatusColor(bill.status) }]}>
                  {getStatusText(bill.status)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailHeaderText}>รายการค่าใช้จ่าย</Text>
              <Text style={styles.detailHeaderSub}>แบ่งยอดอย่างชัดเจน</Text>
            </View>

            {bill.details.map((d, idx) => (
              <View key={idx} style={styles.detailRow}>
                <View style={styles.detailLeft}>
                  <View style={[styles.detailIcon, { backgroundColor: `${d.color}15` }]}>
                    <Ionicons name={d.icon} size={16} color={d.color} />
                  </View>
                  <Text style={styles.detailLabel}>{d.label}</Text>
                </View>
                <Text style={styles.detailValue}>฿{d.value.toLocaleString()}</Text>
              </View>
            ))}

            <View style={styles.detailDivider} />

            <View style={styles.detailRow}>
              <Text style={styles.grandTotalLabel}>ยอดรวมทั้งสิ้น</Text>
              <Text style={styles.grandTotalValue}>฿{bill.amount.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.payNowButton} onPress={openPayModal}>
          <Ionicons name="card-outline" size={20} color="white" />
          <Text style={styles.payNowText}>ชำระบิลทั้งหมด</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showPayModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPayModal(false)}
      >
        <Pressable style={styles.payOverlay} onPress={() => setShowPayModal(false)}>
          <View style={styles.payModal} onStartShouldSetResponder={() => true}>
            <View style={styles.payModalHandle} />

            <View style={styles.payHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.payTitle}>เลือกวิธีชำระเงิน</Text>
                <Text style={styles.paySubtitle}>จ่ายบิลรวมได้ในหน้าต่างเดียว</Text>
              </View>

              <TouchableOpacity style={styles.closeButtonSmall} onPress={() => setShowPayModal(false)}>
                <Ionicons name="close" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.payGrid}>
              <TouchableOpacity
                style={[styles.payOption, selectedMethod === 'qr' && styles.payOptionActive]}
                onPress={() => setSelectedMethod('qr')}
              >
                <View style={[styles.payIconWrap, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="qr-code-outline" size={28} color="#0284C7" />
                </View>
                <Text style={styles.payOptionTitle}>QR Code</Text>
                <Text style={styles.payOptionDesc}>สแกนจ่ายได้ทันที</Text>
                {selectedMethod === 'qr' && <View style={styles.selectedDot} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.payOption, selectedMethod === 'promptpay' && styles.payOptionActive]}
                onPress={() => setSelectedMethod('promptpay')}
              >
                <View style={[styles.payIconWrap, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="phone-portrait-outline" size={28} color="#16A34A" />
                </View>
                <Text style={styles.payOptionTitle}>พร้อมเพย์</Text>
                <Text style={styles.payOptionDesc}>โอนด้วยเบอร์/เลขบัตร</Text>
                {selectedMethod === 'promptpay' && <View style={styles.selectedDot} />}
              </TouchableOpacity>
            </View>

            <View style={styles.payPreview}>
              {selectedMethod === 'qr' ? (
                <>
                  <View style={styles.previewBadge}>
                    <Ionicons name="qr-code" size={18} color="#0284C7" />
                    <Text style={styles.previewBadgeText}>QR Payment</Text>
                  </View>
                  <Image
                    source={{ uri: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=PAYMENT-BILL-204-4180' }}
                    style={styles.qrImage}
                  />
                  <Text style={styles.previewText}>สแกน QR เพื่อชำระยอดรวม ฿4,180</Text>
                </>
              ) : (
                <>
                  <View style={styles.previewBadge}>
                    <Ionicons name="card-outline" size={18} color="#16A34A" />
                    <Text style={styles.previewBadgeText}>PromptPay</Text>
                  </View>

                  <View style={styles.promptBox}>
                    <Text style={styles.promptLabel}>เบอร์โทร/เลขพร้อมเพย์</Text>
                    <Text style={styles.promptValue}>081-234-5678</Text>
                    <Text style={styles.promptHint}>ชื่อบัญชี: Around Loei Dormitory</Text>
                  </View>

                  <Text style={styles.previewText}>โอนยอดรวม ฿4,180 ผ่านพร้อมเพย์ได้ทันที</Text>
                </>
              )}
            </View>

            <TouchableOpacity style={styles.confirmPayButton}>
              <Text style={styles.confirmPayText}>ยืนยันการชำระ</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const MiniSummary = ({ label, value, danger }) => (
  <View style={[styles.miniSummary, danger && { backgroundColor: '#FEF2F2' }]}>
    <Text style={[styles.miniSummaryLabel, danger && { color: '#DC2626' }]}>{label}</Text>
    <Text style={[styles.miniSummaryValue, danger && { color: '#DC2626' }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#0F7EE6',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '900',
  },
  headerSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  heroCard: {
    margin: 16,
    borderRadius: 28,
    backgroundColor: '#0F7EE6',
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '700',
  },
  heroRoom: {
    color: 'white',
    fontSize: 34,
    fontWeight: '900',
    marginTop: 2,
  },
  heroMonth: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    marginTop: 6,
    fontWeight: '600',
  },
  heroIconBox: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  totalCard: {
    marginTop: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 22,
    padding: 16,
  },
  totalRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '700',
  },
  totalBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  totalBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '800',
  },
  totalValue: {
    color: 'white',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 6,
  },
  totalHint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  smallSummaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  miniSummary: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 12,
  },
  miniSummaryLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '700',
  },
  miniSummaryValue: {
    color: 'white',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 4,
  },
  sectionTitleRow: {
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
  },
  billCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  billCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  billLeft: {
    marginRight: 12,
  },
  billIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
  },
  billMiddle: {
    flex: 1,
  },
  billTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  billMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '600',
  },
  billDue: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  billRight: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  billAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  statusBadge: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  detailCard: {
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailHeader: {
    marginBottom: 10,
  },
  detailHeaderText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  detailHeaderSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '700',
  },
  detailValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '900',
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  grandTotalLabel: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '900',
  },
  grandTotalValue: {
    fontSize: 14,
    color: '#0F7EE6',
    fontWeight: '900',
  },
  payNowButton: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 20,
    backgroundColor: '#0F7EE6',
    borderRadius: 18,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  payNowText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '900',
  },
  payOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.64)',
    justifyContent: 'flex-end',
    paddingHorizontal: 0,
  },
  payModal: {
    width: '100%',
    backgroundColor: 'white',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 18,
    paddingBottom: 24,
  },
  payModalHandle: {
    width: 54,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 14,
  },
  payHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  payTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  paySubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  closeButtonSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  payOption: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 16,
    alignItems: 'center',
    minHeight: 156,
  },
  payOptionActive: {
    borderColor: '#0F7EE6',
    backgroundColor: '#EFF6FF',
  },
  payIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  payOptionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  payOptionDesc: {
    marginTop: 6,
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '600',
  },
  selectedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0F7EE6',
    marginTop: 12,
  },
  payPreview: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'white',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  previewBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  qrImage: {
    width: 190,
    height: 190,
    borderRadius: 18,
    backgroundColor: 'white',
    marginBottom: 12,
  },
  previewText: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    fontWeight: '600',
  },
  promptBox: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  promptLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
  },
  promptValue: {
    fontSize: 20,
    color: '#0F172A',
    fontWeight: '900',
    marginTop: 4,
  },
  promptHint: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '700',
    marginTop: 4,
  },
  confirmPayButton: {
    backgroundColor: '#10B981',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmPayText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '900',
  },
});