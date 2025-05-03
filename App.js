import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  Image,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import axios from "axios";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useFrameCallback,
} from "react-native-reanimated";

const BUBBLE_MIN_SIZE = 80;
const BUBBLE_MAX_SIZE = 180;

export default function App() {
  const [coins, setCoins] = useState([]);
  const [cryptoCount, setCryptoCount] = useState("20");
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [bubbleSizeMode, setBubbleSizeMode] = useState("market_cap");

  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const headerHeight = 150;
  const bubbleAreaHeight = screenHeight - headerHeight;

  const fetchCoins = async (count) => {
    try {
      const res = await axios.get(
        "https://api.coingecko.com/api/v3/coins/markets",
        {
          params: {
            vs_currency: "usd",
            order: "market_cap_desc",
            per_page: count,
            page: 1,
          },
        }
      );
      setCoins(res.data);
    } catch (err) {
      console.error("Error fetching coins:", err);
    }
  };

  useEffect(() => {
    const parsedCount = parseInt(cryptoCount);
    if (!isNaN(parsedCount) && parsedCount > 0 && parsedCount <= 250) {
      fetchCoins(parsedCount);
    }
  }, [fetchTrigger]);

  return (
    <View style={styles.container}>
      <View style={styles.headerArea}>
        <Text style={styles.heading}>BubbleCap</Text>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={cryptoCount}
            onChangeText={setCryptoCount}
            keyboardType="numeric"
            placeholder="Enter number (e.g., 20)"
            placeholderTextColor="#888"
          />
          <Picker
            selectedValue={bubbleSizeMode}
            style={styles.picker}
            onValueChange={(itemValue) => setBubbleSizeMode(itemValue)}
          >
            <Picker.Item label="Market Cap" value="market_cap" />
            <Picker.Item label="24h % Change" value="change_24h" />
          </Picker>
          <TouchableOpacity
            style={styles.button}
            onPress={() => setFetchTrigger((n) => n + 1)}
          >
            <Text style={styles.buttonText}>Load</Text>
          </TouchableOpacity>
        </View>
      </View>

      <BubbleArena
        coins={coins}
        height={bubbleAreaHeight}
        width={screenWidth}
        bubbleSizeMode={bubbleSizeMode}
      />
    </View>
  );
}

function BubbleArena({ coins, height, width, bubbleSizeMode }) {
  const bubbles = [];

  const values = coins.map((c) =>
    bubbleSizeMode === "market_cap"
      ? c.market_cap
      : Math.abs(c.price_change_percentage_24h)
  );
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);

  return (
    <View
      style={{ position: "absolute", top: 150, left: 0, right: 0, bottom: 0 }}
    >
      {coins.map((coin, index) => {
        const bubbleRef = {};

        const rawVal =
          bubbleSizeMode === "market_cap"
            ? coin.market_cap
            : Math.abs(coin.price_change_percentage_24h);
        const norm = (rawVal - minVal) / (maxVal - minVal || 1);
        const size =
          BUBBLE_MIN_SIZE + norm * (BUBBLE_MAX_SIZE - BUBBLE_MIN_SIZE);

        const component = (
          <Bubble
            key={coin.id}
            coin={coin}
            index={index}
            size={size}
            screenWidth={width}
            screenHeight={height}
            allBubbles={bubbles}
            refObj={bubbleRef}
          />
        );
        bubbles.push(bubbleRef);
        return component;
      })}
    </View>
  );
}

function Bubble({
  coin,
  index,
  size,
  screenWidth,
  screenHeight,
  allBubbles,
  refObj,
}) {
  const radius = size / 2;
  const change24h = coin.price_change_percentage_24h;
  const isPositive = change24h >= 0;

  const x = useSharedValue(Math.random() * (screenWidth - size));
  const y = useSharedValue(Math.random() * (screenHeight - size));
  const dx = useSharedValue((Math.random() - 0.5) * 0.3);
  const dy = useSharedValue((Math.random() - 0.5) * 0.3);

  refObj.get = () => ({ x: x.value, y: y.value, radius, xRef: x, yRef: y });

  useFrameCallback(() => {
    x.value += dx.value;
    y.value += dy.value;

    if (x.value <= 0 || x.value + size >= screenWidth) {
      dx.value *= -1;
      x.value = Math.min(Math.max(x.value, 0), screenWidth - size);
    }
    if (y.value <= 0 || y.value + size >= screenHeight) {
      dy.value *= -1;
      y.value = Math.min(Math.max(y.value, 0), screenHeight - size);
    }

    allBubbles.forEach((other) => {
      if (other.get && other !== refObj) {
        const { x: ox, y: oy, radius: or, xRef, yRef } = other.get();
        const dxPos = x.value - ox;
        const dyPos = y.value - oy;
        const dist = Math.sqrt(dxPos * dxPos + dyPos * dyPos);
        const minDist = radius + or;

        if (dist < minDist && dist > 0) {
          const overlap = minDist - dist;
          const nx = dxPos / dist;
          const ny = dyPos / dist;
          x.value += nx * (overlap / 2);
          y.value += ny * (overlap / 2);
          xRef.value -= nx * (overlap / 2);
          yRef.value -= ny * (overlap / 2);
        }
      }
    });
  });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    shadowColor: isPositive ? "#00FF7F" : "#FF4D4D",
    shadowOpacity: 0.9,
    shadowRadius: 15,
    elevation: 10,
  }));

  return (
    <Animated.View style={[styles.bubble, animStyle]}>
      <View style={styles.imageWrapper}>
        <Image
          source={{ uri: coin.image }}
          style={styles.coinImage}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.bubbleText}>{coin.symbol.toUpperCase()}</Text>
      <Text style={styles.bubbleText}>
        ${coin.current_price.toLocaleString()}
      </Text>
      <Text style={styles.bubbleText}>
        {isPositive ? "+" : ""}
        {change24h?.toFixed(2)}%
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  headerArea: {
    zIndex: 2,
    paddingTop: 40,
    paddingBottom: 10,
    backgroundColor: "#121212",
  },
  heading: {
    color: "white",
    fontSize: 20,
    textAlign: "center",
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#00A86B",
    borderRadius: 6,
    color: "white",
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 80,
    fontSize: 14,
  },
  picker: {
    width: 150,
    color: "white",
    backgroundColor: "#1e1e1e",
    borderRadius: 6,
  },
  button: {
    backgroundColor: "#00A86B",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
  bubble: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    padding: 4,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  bubbleText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 12,
    textAlign: "center",
  },
  imageWrapper: {
    width: 32,
    height: 32,
    marginBottom: 4,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "white",
  },
  coinImage: {
    width: "100%",
    height: "100%",
  },
});
