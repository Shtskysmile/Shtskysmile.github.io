# 数据库与 SQL 面试复习资料

> [!NOTE] 声明
> 这个是蓝色大肥鱼写的，参考了往年绿群的一些公开资料，读者自理。
>
> 标注：`[面]` 面试高频，`[笔]` 笔试高频，`[面/笔]` 两者都可能。

## 基础

**1. [面/笔] 什么是主键、外键、候选键？**

主键用来唯一标识一行记录，不能重复且通常不能为空；候选键是所有能唯一标识记录的最小键集合，主键是从候选键中选出的一个；外键用于建立表与表之间的关联，保证引用完整性。

**2. [面/笔] 什么是范式？第一范式、第二范式、第三范式分别在解决什么问题？**

范式是为了减少冗余和插入、删除、更新异常而提出的设计规范。第一范式要求字段原子化；第二范式要求非主属性完全依赖主键，主要解决对复合主键的部分依赖；第三范式要求非主属性不经由其他非主属性传递依赖主键，主要解决传递依赖。BCNF 比三范式更强，要求每个决定因素都必须是候选键，用来处理某些三范式下仍可能存在的冗余异常。

**3. [面/笔] 什么是事务？ACID 分别是什么？**

事务是一组要么全部成功、要么全部失败的操作集合。ACID 分别是原子性、一致性、隔离性、持久性。

**4. [面/笔] 什么是索引？索引一定越多越好吗？**

索引是加速查询的数据结构，本质上是用额外空间换查询时间。索引不是越多越好，因为索引会占空间、拖慢写入，还可能让优化器选错计划。

**5. [面/笔] `INNER JOIN`、`LEFT JOIN`、`RIGHT JOIN` 的区别是什么？**

`INNER JOIN` 只保留两表都匹配上的记录；`LEFT JOIN` 保留左表全部记录，右表匹配不上时补空；`RIGHT JOIN` 则相反，保留右表全部记录。

**6. [面/笔] `GROUP BY` 和 `HAVING` 的区别是什么？**

`GROUP BY` 用于分组，`HAVING` 用于对分组后的结果过滤；而 `WHERE` 是对分组前的原始行过滤。

**7. [面/笔] 什么是聚簇索引和非聚簇索引？**

聚簇索引决定了数据在磁盘上的物理组织方式，表数据本身就按该索引顺序存储；非聚簇索引只保存索引项和指针，需要再定位到真实数据页。

**8. [笔] 写 SQL：统计每个用户的订单数、平均订单金额、最近一次下单时间。**

假设表为 `orders(user_id, amount, order_time)`，可写为：

```sql
SELECT
  user_id,
  COUNT(*) AS order_cnt,
  AVG(amount) AS avg_amount,
  MAX(order_time) AS last_order_time
FROM orders
GROUP BY user_id;
```

## 进阶

**1. [面/笔] 为什么数据库索引通常使用 B+ 树而不是红黑树？**

B+ 树更矮，磁盘 I/O 次数更少；非叶子节点只存键，扇出更大；叶子节点天然有序，范围查询特别方便。红黑树更适合内存结构，不适合磁盘页组织。

**2. [面] 什么是 MVCC？它解决了什么问题？**

MVCC 是多版本并发控制，让读操作读到某个时间点的一致性快照，减少读写互斥。它主要提升并发下的读性能，并避免大量锁冲突。

**3. [面/笔] 读未提交、读已提交、可重复读、串行化分别能避免哪些并发问题？**

读未提交几乎不避免问题；读已提交避免脏读；可重复读进一步避免不可重复读；串行化最严格，也能避免幻读，但并发度最低。

**4. [面] 什么是脏读、不可重复读、幻读？**

脏读是读到了别的事务尚未提交的数据；不可重复读是同一事务内两次读同一行结果不同；幻读是同一事务内两次按条件查询，结果集行数变化了。

**5. [面] 悲观锁和乐观锁的区别是什么？**

悲观锁假设冲突经常发生，先加锁再操作；乐观锁假设冲突少，通常用版本号或 CAS，在提交时检查是否冲突。前者安全直接，后者并发更高。

**6. [面] 为什么有时加了索引 SQL 还是很慢？**

可能是索引选择性差、查询没走到索引、发生回表、排序或分组仍然昂贵，或者数据量太小优化器认为全表扫更划算。也可能是函数、隐式类型转换破坏了索引使用。

**7. [面] 什么是覆盖索引？什么是回表？**

覆盖索引指查询需要的列都能从索引中直接拿到，不必再访问数据页。回表则是先通过索引找到主键或地址，再到主表取剩余列。

**8. [笔] 写 SQL：找出「浏览过但从未购买」的用户，按最近活跃时间降序输出。**

假设表为 `user_behavior(user_id, item_id, action, ts)`：

```sql
SELECT
  user_id,
  MAX(ts) AS last_active_time
FROM user_behavior
GROUP BY user_id
HAVING SUM(CASE WHEN action = 'click' THEN 1 ELSE 0 END) > 0
   AND SUM(CASE WHEN action = 'buy' THEN 1 ELSE 0 END) = 0
ORDER BY last_active_time DESC;
```

## 拔高

**1. [面/笔] 写 SQL：在用户-商品行为表中统计每个用户的转化漏斗 `click -> cart -> buy`。**

常见思路是先按用户聚合三类行为次数，再计算比率：

```sql
SELECT
  user_id,
  SUM(CASE WHEN action = 'click' THEN 1 ELSE 0 END) AS click_cnt,
  SUM(CASE WHEN action = 'cart' THEN 1 ELSE 0 END) AS cart_cnt,
  SUM(CASE WHEN action = 'buy' THEN 1 ELSE 0 END) AS buy_cnt,
  1.0 * SUM(CASE WHEN action = 'cart' THEN 1 ELSE 0 END)
      / NULLIF(SUM(CASE WHEN action = 'click' THEN 1 ELSE 0 END), 0) AS click_to_cart,
  1.0 * SUM(CASE WHEN action = 'buy' THEN 1 ELSE 0 END)
      / NULLIF(SUM(CASE WHEN action = 'cart' THEN 1 ELSE 0 END), 0) AS cart_to_buy
FROM user_behavior
GROUP BY user_id;
```

若题目要求严格按同一商品或时间顺序统计，还需要在用户-商品维度上进一步细化。

**2. [面] InnoDB 在可重复读隔离级别下是怎么避免幻读的？**

快照读靠 MVCC，事务开始时（或第一次读时）生成一致性视图，之后读到的都是这个快照，所以别的已提交事务新增的行不会出现在结果里。当前读（`SELECT ... FOR UPDATE`、`UPDATE`、`DELETE`）则依赖 Next-Key Lock，也就是记录锁加上间隙锁，锁住范围而不是单行，阻止其他事务在这个区间插入新记录。两者配合，才让可重复读下基本不出现幻读。

**3. [面] redo log、undo log、binlog 分别解决什么问题？为什么需要两阶段提交？**

redo log 是存储引擎层的物理日志，保证已提交事务的修改在崩溃后能重放出来，实现持久性；undo log 记录反向操作，用于回滚和 MVCC 读旧版本；binlog 是 Server 层的逻辑日志，用于主从复制和数据恢复。因为 redo log 和 binlog 是两套日志，如果分别写就可能只成功一个，导致主库与从库数据不一致，所以提交时要走两阶段提交：先写 redo 并标记 prepare，再写 binlog，最后把 redo 置为 commit。

**4. [面] 缓冲池、刷脏和 checkpoint 之间的关系是什么？为什么这样设计既能快又能持久？**

InnoDB 读写数据都先经过缓冲池，修改先在内存里完成并写 redo，脏页再异步刷回磁盘。如果每次提交都同步刷盘，性能会非常差；而只写内存又会在崩溃时丢数据。redo log 恰好补上这一环：只要 redo 落盘，数据页晚点刷也没问题。checkpoint 用来标记「这之前的脏页都已刷盘」，从而确定 redo 中可以回收的范围，也决定了崩溃恢复的起点。

**5. [面] 读写分离、主从复制会带来什么一致性问题？工程上怎么缓解？**

MySQL 默认的异步复制下，主库提交后从库可能还没收到 binlog，于是刚写完立刻去从库读就可能读到旧数据，这叫复制延迟导致的不一致。缓解方式包括：对一致性要求高的读强制走主库、写后短时间内的读也走主库、用半同步复制牺牲一点写延迟换可靠、或者用 GTID 加位点等待保证读到不低于某个位点。

## 限时短笔练习

限时手写，控制在 30 分钟内完成。统一假设行为表为 `user_behavior(user_id, item_id, action, ts)`。

**1. [笔] 统计每个用户的购买次数。**

```sql
SELECT user_id, COUNT(*) AS buy_cnt
FROM user_behavior
WHERE action = 'buy'
GROUP BY user_id;
```

**2. [笔] 查询「点击过但从未购买过任何商品」的用户。**

```sql
SELECT user_id
FROM user_behavior
GROUP BY user_id
HAVING SUM(CASE WHEN action = 'click' THEN 1 ELSE 0 END) > 0
   AND SUM(CASE WHEN action = 'buy' THEN 1 ELSE 0 END) = 0;
```

**3. [笔] 查询每个用户最近一次行为对应的 `action` 和时间。**

```sql
WITH ranked AS (
  SELECT
    user_id,
    action,
    ts,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY ts DESC) AS rn
  FROM user_behavior
)
SELECT user_id, action, ts
FROM ranked
WHERE rn = 1;
```

**4. [笔] 查询每个商品从 `click -> cart -> buy` 的转化率。**

```sql
SELECT
  item_id,
  SUM(CASE WHEN action = 'click' THEN 1 ELSE 0 END) AS click_cnt,
  SUM(CASE WHEN action = 'cart' THEN 1 ELSE 0 END) AS cart_cnt,
  SUM(CASE WHEN action = 'buy' THEN 1 ELSE 0 END) AS buy_cnt,
  1.0 * SUM(CASE WHEN action = 'cart' THEN 1 ELSE 0 END)
      / NULLIF(SUM(CASE WHEN action = 'click' THEN 1 ELSE 0 END), 0) AS click_to_cart,
  1.0 * SUM(CASE WHEN action = 'buy' THEN 1 ELSE 0 END)
      / NULLIF(SUM(CASE WHEN action = 'cart' THEN 1 ELSE 0 END), 0) AS cart_to_buy
FROM user_behavior
GROUP BY item_id;
```

**5. [笔] 查询每个年级平均分最高的学生姓名、年级、平均分。**

假设有 `student(id, name, grade)` 和 `score(student_id, score)`：

```sql
WITH avg_score AS (
  SELECT s.id, s.name, s.grade, AVG(sc.score) AS avg_score
  FROM student s
  JOIN score sc ON s.id = sc.student_id
  GROUP BY s.id, s.name, s.grade
),
ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (PARTITION BY grade ORDER BY avg_score DESC) AS rn
  FROM avg_score
)
SELECT name, grade, avg_score
FROM ranked
WHERE rn = 1;
```
