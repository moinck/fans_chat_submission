import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
export const StatusBanner = ({ online, notice }: { online: boolean; notice?: string }) => (!online || notice) ? <View accessibilityRole="alert" style={[styles.banner, !online && styles.offline]}><Text style={styles.text}>{!online ? 'Offline — messages are safely queued' : notice}</Text></View> : null;
const styles = StyleSheet.create({ banner:{ backgroundColor:'#E0F2FE', paddingHorizontal:16,paddingVertical:8 }, offline:{ backgroundColor:'#FFF0C7' }, text:{ textAlign:'center',fontSize:13,fontWeight:'600',color:'#154B70' } });
